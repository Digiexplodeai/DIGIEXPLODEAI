# Security Specification for DigiexplodeAI Attendance Management

## 1. Data Invariants
- An attendance record cannot be marked for a date other than standard date formats (YYYY-MM-DD).
- Attendance check-in and check-out times must be formatted correctly.
- Attendance can only be marked/modified by an Authorized Admin (`superAdmin` or `admin`).
- Employees can only read their own attendance records.
- Employees can only read and create their own leave requests.
- Leave requests can only be approved/rejected by an Admin.
- No client/employee can elevate their own role to admin or superAdmin.

## 2. The "Dirty Dozen" Payloads (Exploit Verification)
These payloads represent malicious attempts to bypass identity, integrity, and state bounds. They must be rejected by Firestore Security Rules.

1. **Self-Promotion via Signup**: A user attempts to sign up with `role: "superAdmin"`.
2. **Attendance Mark by Employee**: An employee attempts to mark their own or someone else's daily attendance.
3. **Ghost Fields injection on Attendance**: An Admin attempts to write an attendance record with a ghost field `approvedByAdmin: true` where it shouldn't exist.
4. **Attendance Date Poisoning**: Creating an attendance record with a 1MB string or invalid ID.
5. **Unauthorized Employee Update**: An employee attempts to change their status to "Active" or edit their salary.
6. **Cross-Employee Attendance Query**: An employee attempts to query/list attendance records of other employees.
7. **Leave Approval Hijack**: An employee attempts to update their own leave request status to `Approved`.
8. **Leave Request Spoofing**: An employee creates a leave request with `employeeId` of another employee.
9. **Salary Override**: An employee attempts to update their monthly salary field in the database.
10. **System log tampering**: Attempting to edit or delete system activity logs.
11. **Anonymously created leave requests**: Attempting to request leaves without signing in.
12. **Double check-in override**: Attempting to bypass validations and write raw timestamps from the client.

## 3. Rules Verification Test Plan
All test cases for the "Dirty Dozen" payloads must trigger `PERMISSION_DENIED` errors on read/write when evaluated against our updated `firestore.rules`.
