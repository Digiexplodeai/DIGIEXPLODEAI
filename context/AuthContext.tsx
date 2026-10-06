import React, { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: "superAdmin" | "admin" | "client" | "employee";
  clientId?: string;
  assignedClientIds?: string[];
  status: "active" | "inactive";
  createdAt: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    pass: string,
    name: string,
    phone: string,
    role?: "client" | "employee",
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsDemoRole: (role?: "superAdmin" | "admin" | "employee" | "client") => Promise<void> | void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Read any cached demo selection
        let cachedDemoRole: "superAdmin" | "admin" | "employee" | "client" | null = null;
        let cachedDemoObj: any = null;
        try {
          const cached = localStorage.getItem("digi_demo_profile");
          if (cached) {
            cachedDemoObj = JSON.parse(cached);
            cachedDemoRole = cachedDemoObj.role;
          }
        } catch (e) {
          // ignore cache read error
        }

        // Real-time listener for user profile to support real-time role updates
        const docRef = doc(db, "users", currentUser.uid);
        const unsubscribeProfile = onSnapshot(
          docRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserProfile;
              // If cached demo profile is superAdmin/admin/employee but doc had default client, upgrade it
              if (cachedDemoRole && cachedDemoRole !== "client" && data.role === "client" && (currentUser.isAnonymous || !currentUser.email)) {
                const upgradedProfile: UserProfile = {
                  ...data,
                  name: cachedDemoObj?.name || data.name || "Digiexplode Super Admin",
                  role: cachedDemoRole,
                  email: cachedDemoObj?.email || "admin@digiexplode.ai"
                };
                setProfile(upgradedProfile);
                setDoc(doc(db, "users", currentUser.uid), upgradedProfile, { merge: true }).catch(console.warn);
              } else {
                setProfile(data);
              }
              setLoading(false);

              // Auto-healing / auto-bridging background task for clients with missing clientId
              if (data.role === "client" && !data.clientId && data.email) {
                try {
                  const clientsRef = collection(db, "clients");
                  const qClients = query(clientsRef, where("email", "==", data.email.trim().toLowerCase()));
                  const clientSnap = await getDocs(qClients);
                  if (!clientSnap.empty) {
                    const firstClientDoc = clientSnap.docs[0];
                    const matchedClientId = firstClientDoc.id;
                    await updateDoc(doc(db, "users", currentUser.uid), {
                      clientId: matchedClientId
                    });
                  }
                } catch (err) {
                  console.error("Auto-bridge background check failed: ", err);
                }
              }
            } else {
              // Profile does not exist yet (e.g., first sign-in via Google, anonymous, or freshly created user)
              const cleanEmail = currentUser.email?.toLowerCase() || "";
              const isBootstrappedAdmin =
                cleanEmail === "dilseinvite@gmail.com" ||
                cleanEmail.includes("admin") ||
                cleanEmail.endsWith("@digiexplode.ai");
              const isVansh = cleanEmail.includes("vansh") || cleanEmail.includes("employee");

              let autoClientId: string | undefined = undefined;
              const assignedRole: "superAdmin" | "admin" | "employee" | "client" = cachedDemoRole
                ? cachedDemoRole
                : isBootstrappedAdmin
                  ? "superAdmin"
                  : isVansh
                    ? "employee"
                    : "client"; // Anonymous users no longer auto-assigned superAdmin

              if (assignedRole === "client" && currentUser.email) {
                try {
                  const clientsRef = collection(db, "clients");
                  const qClients = query(clientsRef, where("email", "==", currentUser.email.trim().toLowerCase()));
                  const clientSnap = await getDocs(qClients);
                  if (!clientSnap.empty) {
                    autoClientId = clientSnap.docs[0].id;
                  }
                } catch (e) {
                  console.warn("Could not check client email match during signup: ", e);
                }
              }

              const newProfile: UserProfile = {
                userId: currentUser.uid,
                name:
                  cachedDemoObj?.name ||
                  currentUser.displayName ||
                  currentUser.email?.split("@")[0] ||
                  (assignedRole === "superAdmin" ? "Digiexplode Super Admin" : "User"),
                email: cachedDemoObj?.email || currentUser.email || (assignedRole === "superAdmin" ? "admin@digiexplode.ai" : ""),
                phone: cachedDemoObj?.phone || currentUser.phoneNumber || "+91 87250 72730",
                role: assignedRole,
                clientId: autoClientId || cachedDemoObj?.clientId,
                status: "active",
                createdAt: new Date().toISOString(),
              };

              try {
                await setDoc(doc(db, "users", currentUser.uid), newProfile, { merge: true });
                setProfile(newProfile);
              } catch (err) {
                console.error("Error creating user profile in Firestore", err);
              }
              setLoading(false);
            }
          },
          (error) => {
            console.error("Error fetching user profile snapshot", error);
            setLoading(false);
          },
        );

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    
    // Direct Super Admin quick credentials fallback (ID: admin, Password: admin123)
    if (
      cleanEmail === "admin" ||
      cleanEmail === "admin@digiexplode.ai" ||
      cleanEmail === "superadmin" ||
      cleanEmail === "superadmin@digiexplode.ai" ||
      cleanEmail === "dilseinvite@gmail.com"
    ) {
      if (pass !== "admin123") {
        setLoading(false);
        throw new Error("Invalid password for Super Admin. Password must be admin123");
      }
      loginAsDemoRole("superAdmin");
      return;
    }

    if (cleanEmail === "employee" || cleanEmail.includes("vansh")) {
      loginAsDemoRole("employee");
      return;
    }

    if (cleanEmail === "client" || cleanEmail === "client@nexuscoaching.com") {
      loginAsDemoRole("client");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    name: string,
    phone: string,
    assignedRole: "client" | "employee" = "client",
  ) => {
    setLoading(true);
    try {
      const isBootstrappedAdmin =
        email.toLowerCase() === "dilseinvite@gmail.com";
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        pass,
      );
      const newUser = userCredential.user;

      let autoClientId: string | undefined = undefined;
      if (assignedRole === "client") {
        try {
          const clientsRef = collection(db, "clients");
          const qClients = query(clientsRef, where("email", "==", email.trim().toLowerCase()));
          const clientSnap = await getDocs(qClients);
          if (!clientSnap.empty) {
            autoClientId = clientSnap.docs[0].id;
          }
        } catch (e) {
          console.warn("Could not check client email match during custom signup: ", e);
        }
      }

      const newProfile: UserProfile = {
        userId: newUser.uid,
        name,
        email,
        phone,
        role: isBootstrappedAdmin ? "superAdmin" : assignedRole,
        clientId: autoClientId,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "users", newUser.uid), newProfile);
      setProfile(newProfile);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const loginAsDemoRole = async (role: "superAdmin" | "admin" | "employee" | "client" = "superAdmin") => {
    setLoading(true);
    const demoProfiles: Record<string, UserProfile> = {
      superAdmin: {
        userId: "demo-super-admin-01",
        name: "Digiexplode Super Admin",
        email: "admin@digiexplode.ai",
        phone: "+91 87250 72730",
        role: "superAdmin",
        status: "active",
        createdAt: new Date().toISOString(),
      },
      admin: {
        userId: "demo-agency-admin-02",
        name: "Agency Operations Admin",
        email: "operations@digiexplode.ai",
        phone: "+91 98765 43210",
        role: "admin",
        status: "active",
        createdAt: new Date().toISOString(),
      },
      employee: {
        userId: "demo-employee-03",
        name: "Vansh Creative Specialist",
        email: "vansh@digiexplode.ai",
        phone: "+91 87250 72731",
        role: "employee",
        status: "active",
        createdAt: new Date().toISOString(),
      },
      client: {
        userId: "demo-client-04",
        name: "Nexus Coaching Team",
        email: "client@nexuscoaching.com",
        phone: "+91 91234 56789",
        role: "client",
        clientId: "client_nexus_coaching",
        status: "active",
        createdAt: new Date().toISOString(),
      },
    };

    const selected = demoProfiles[role] || demoProfiles.superAdmin;
    localStorage.setItem("digi_demo_profile", JSON.stringify(selected));

    try {
      let activeUser = auth.currentUser;
      if (!activeUser) {
        const cred = await signInAnonymously(auth);
        activeUser = cred.user;
      }

      if (activeUser) {
        const authUidProfile: UserProfile = {
          ...selected,
          userId: activeUser.uid,
        };
        await setDoc(doc(db, "users", activeUser.uid), authUidProfile, { merge: true });
        setUser(activeUser);
        setProfile(authUidProfile);
      } else {
        setUser({
          uid: selected.userId,
          email: selected.email,
          displayName: selected.name,
          phoneNumber: selected.phone,
        } as any);
        setProfile(selected);
      }
      // Also write legacy demo document for cross-compatibility
      await setDoc(doc(db, "users", selected.userId), selected, { merge: true });
    } catch (err) {
      console.warn("Demo profile sync notice:", err);
      setUser({
        uid: selected.userId,
        email: selected.email,
        displayName: selected.name,
        phoneNumber: selected.phone,
      } as any);
      setProfile(selected);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem("digi_demo_profile");
    if (cached && !profile) {
      try {
        const parsed = JSON.parse(cached) as UserProfile;
        setProfile(parsed);
        if (!user) {
          setUser({
            uid: parsed.userId,
            email: parsed.email,
            displayName: parsed.name,
            phoneNumber: parsed.phone,
          } as any);
        }

        if (!auth.currentUser) {
          signInAnonymously(auth).then(async (cred) => {
            if (cred?.user) {
              await setDoc(doc(db, "users", cred.user.uid), {
                ...parsed,
                userId: cred.user.uid,
              }, { merge: true });
            }
          }).catch(e => console.warn("Demo auto-auth notice:", e));
        } else {
          setDoc(doc(db, "users", auth.currentUser.uid), {
            ...parsed,
            userId: auth.currentUser.uid,
          }, { merge: true }).catch(e => console.warn("User sync notice:", e));
        }
      } catch (e) {
        localStorage.removeItem("digi_demo_profile");
      }
    }
  }, [profile, user]);

  const signOutUser = async () => {
    setLoading(true);
    localStorage.removeItem("digi_demo_profile");
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Signout warning:", e);
    }
    setProfile(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOutUser,
        loginWithEmail,
        signUpWithEmail,
        loginWithGoogle,
        loginAsDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.error("useAuth missing provider error stack:", new Error().stack);
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
