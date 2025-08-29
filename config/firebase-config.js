/**
 * Firebase Configuration for TeacherPay Pro
 * Replace Google Sheets with Firebase Realtime Database
 */

// Prevent multiple loading
if (typeof window.FIREBASE_CONFIG_LOADED === 'undefined') {
    window.FIREBASE_CONFIG_LOADED = true;

    // Firebase configuration
    window.FIREBASE_CONFIG = {
        // Your Firebase project configuration
        // Get this from: https://console.firebase.google.com/
        apiKey: "AIzaSyCT3RdcoNjvcK1qFmcCVwoyB-6vUMmjvRI",
        authDomain: "payment-slip-97222.firebaseapp.com",
        databaseURL: "https://payment-slip-97222-default-rtdb.firebaseio.com",
        projectId: "payment-slip-97222",
        storageBucket: "payment-slip-97222.firebasestorage.app",
        messagingSenderId: "401786967167",
        appId: "1:401786967167:web:8df0ae4fbec9da481fdb4a"
    };
    
    // Also set firebaseConfig for compatibility
    window.firebaseConfig = window.FIREBASE_CONFIG;

    // Database structure for TeacherPay Pro
    window.DB_STRUCTURE = {
        teachers: {
            // teacherId: {
            //     id: string,
            //     name: string,
            //     email: string,
            //     phone: string,
            //     designation: string,
            //     department: string,
            //     status: string, // 'pending', 'approved', 'rejected'
            //     registrationDate: timestamp,
            //     approvedBy: string,
            //     approvalDate: timestamp,
            //     employmentType: string
            // }
        },
        salarySlips: {
            // slipId: {
            //     id: string,
            //     teacherId: string,
            //     month: string,
            //     year: string,
            //     monthNum: string,
            //     payDate: string,
            //     grossSalary: number,
            //     basicSalary: number,
            //     hra: number,
            //     da: number,
            //     allowances: number,
            //     pf: number,
            //     esi: number,
            //     tax: number,
            //     otherDeductions: number,
            //     totalDeductions: number,
            //     netPay: number,
            //     status: string,
            //     createdAt: timestamp
            // }
        },
        admins: {
            // adminId: {
            //     id: string,
            //     username: string,
            //     email: string,
            //     role: string,
            //     createdAt: timestamp,
            //     lastLogin: timestamp
            // }
        },
        paysheets: {
            // monthYear: {
            //     month: string,
            //     year: string,
            //     records: {
            //         teacherId: salarySlipData
            //     },
            //     summary: {
            //         totalTeachers: number,
            //         totalGross: number,
            //         totalDeductions: number,
            //         totalNet: number
            //     },
            //     createdAt: timestamp
            // }
        }
    };
}
