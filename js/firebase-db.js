/**
 * Firebase Realtime Database Integration for TeacherPay Pro
 * Replaces Google Sheets with Firebase real-time functionality
 */

class FirebaseDB {
    constructor(config) {
        this.config = config;
        this.db = null;
        this.initialized = false;
        this.listeners = new Map(); // Store active listeners for cleanup
    }

    /**
     * Initialize Firebase connection
     */
    async initialize() {
        try {
            // Initialize Firebase with config if not already initialized
            if (!firebase.apps.length) {
                // Use global firebaseConfig if available, otherwise use passed config
                const config = this.config || (typeof firebaseConfig !== 'undefined' ? firebaseConfig : null);
                if (!config) {
                    throw new Error('Firebase configuration not found');
                }
                firebase.initializeApp(config);
            }
            
            this.db = firebase.database();
            this.initialized = true;
            console.log('✅ Firebase DB initialized successfully');
            
            // Setup initial database structure if needed
            await this.setupInitialStructure();
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Firebase DB:', error);
            this.initialized = false;
            return false;
        }
    }

    /**
     * Setup initial database structure
     */
    async setupInitialStructure() {
        // Skip initialization - collections will be created when data is added
        console.log('✅ Database structure setup skipped - collections created on demand');
    }

    /**
     * Add a new teacher with real-time updates
     */
    async addTeacher(teacherData) {
        if (!this.initialized) throw new Error('Firebase DB not initialized');

        try {
            const teacherId = teacherData.id || this.generateId();
            const teacherRef = this.db.ref(`teachers/${teacherId}`);
            
            const teacher = {
                id: teacherId,
                name: teacherData.name || '',
                email: teacherData.email || '',
                phone: teacherData.phone || '',
                designation: teacherData.designation || '',
                department: teacherData.department || '',
                status: teacherData.status || 'pending',
                registrationDate: teacherData.registrationDate || firebase.database.ServerValue.TIMESTAMP,
                approvedBy: teacherData.approvedBy || '',
                approvalDate: teacherData.approvalDate || null,
                employmentType: teacherData.employmentType || 'Permanent',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };

            await teacherRef.set(teacher);
            console.log(`✅ Teacher added: ${teacherId}`);
            return { success: true, id: teacherId };
        } catch (error) {
            console.error('Error adding teacher:', error);
            throw error;
        }
    }

    /**
     * Get all teachers with real-time listener
     */
    getTeachers(callback) {
        if (!this.initialized) throw new Error('Firebase DB not initialized');

        const teachersRef = this.db.ref('teachers');
        
        // Remove existing listener if any
        if (this.listeners.has('teachers')) {
            teachersRef.off('value', this.listeners.get('teachers'));
        }

        const listener = teachersRef.on('value', (snapshot) => {
            const teachers = [];
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    teachers.push({
                        ...childSnapshot.val(),
                        id: childSnapshot.key
                    });
                });
            }
            callback(teachers);
        });

        this.listeners.set('teachers', listener);
        return () => teachersRef.off('value', listener); // Return cleanup function
    }

    /**
     * Update teacher status with real-time sync
     */
    async updateTeacherStatus(teacherId, status, approvedBy) {
        if (!this.initialized) throw new Error('Firebase DB not initialized');

        try {
            const teacherRef = this.db.ref(`teachers/${teacherId}`);
            const updates = {
                status: status,
                approvedBy: approvedBy,
                approvalDate: firebase.database.ServerValue.TIMESTAMP,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };

            await teacherRef.update(updates);
            console.log(`✅ Teacher status updated: ${teacherId} -> ${status}`);
            return { success: true };
        } catch (error) {
            console.error('Error updating teacher status:', error);
            throw error;
        }
    }

    /**
     * Add salary slip with real-time updates
     */
    async addSalarySlip(salarySlipData) {
        if (!this.initialized) throw new Error('Firebase DB not initialized');

        try {
            const slipId = salarySlipData.id || this.generateId();
            const slipRef = this.db.ref(`salarySlips/${slipId}`);

            const salarySlip = {
                id: slipId,
                teacherId: salarySlipData.teacherId || '',
                month: salarySlipData.month || '',
                year: salarySlipData.year || '',
                monthNum: salarySlipData.monthNum || '',
                payDate: salarySlipData.payDate || '',
                grossSalary: parseFloat(salarySlipData.grossSalary) || 0,
                basicSalary: parseFloat(salarySlipData.basicSalary) || 0,
                hra: parseFloat(salarySlipData.hra) || 0,
                da: parseFloat(salarySlipData.da) || 0,
                allowances: parseFloat(salarySlipData.allowances) || 0,
                pf: parseFloat(salarySlipData.pf) || 0,
                esi: parseFloat(salarySlipData.esi) || 0,
                tax: parseFloat(salarySlipData.tax) || 0,
                otherDeductions: parseFloat(salarySlipData.otherDeductions) || 0,
                totalDeductions: parseFloat(salarySlipData.totalDeductions) || 0,
                netPay: parseFloat(salarySlipData.netPay) || 0,
                status: salarySlipData.status || 'paid',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };

            await slipRef.set(salarySlip);
            console.log(`✅ Salary slip added: ${slipId}`);
            return { success: true, id: slipId };
        } catch (error) {
            console.error('Error adding salary slip:', error);
            throw error;
        }
    }

    /**
     * Get salary slips for a teacher with real-time updates
     */
    getSalarySlips(teacherId, callback) {
        if (!this.initialized) throw new Error('Firebase DB not initialized');

        const slipsRef = this.db.ref('salarySlips').orderByChild('teacherId').equalTo(teacherId);
        
        const listenerId = `salarySlips_${teacherId}`;
        if (this.listeners.has(listenerId)) {
            slipsRef.off('value', this.listeners.get(listenerId));
        }

        const listener = slipsRef.on('value', (snapshot) => {
            const salarySlips = [];
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    salarySlips.push({
                        ...childSnapshot.val(),
                        id: childSnapshot.key
                    });
                });
            }
            callback(salarySlips);
        });

        this.listeners.set(listenerId, listener);
        return () => slipsRef.off('value', listener);
    }

    /**
     * Create monthly paysheet with real-time updates
     */
    async createMonthlyPaysheet(month, year, paysheetData) {
        if (!this.initialized) throw new Error('Firebase DB not initialized');

        try {
            const paysheetId = `${month}_${year}`;
            const paysheetRef = this.db.ref(`paysheets/${paysheetId}`);

            // Calculate summary
            const summary = {
                totalTeachers: paysheetData.length,
                totalGross: paysheetData.reduce((sum, record) => sum + (parseFloat(record.grossSalary) || 0), 0),
                totalDeductions: paysheetData.reduce((sum, record) => sum + (parseFloat(record.totalDeductions) || 0), 0),
                totalNet: paysheetData.reduce((sum, record) => sum + (parseFloat(record.netPay) || 0), 0)
            };

            const paysheet = {
                id: paysheetId,
                month: month,
                year: year,
                records: {},
                summary: summary,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };

            // Add individual records
            paysheetData.forEach(record => {
                paysheet.records[record.teacherId] = record;
            });

            await paysheetRef.set(paysheet);
            console.log(`✅ Monthly paysheet created: ${paysheetId}`);
            return { success: true, id: paysheetId };
        } catch (error) {
            console.error('Error creating monthly paysheet:', error);
            throw error;
        }
    }

    /**
     * Get monthly paysheet with real-time updates
     */
    getMonthlyPaysheet(month, year, callback) {
        if (!this.initialized) throw new Error('Firebase DB not initialized');

        const paysheetId = `${month}_${year}`;
        const paysheetRef = this.db.ref(`paysheets/${paysheetId}`);
        
        const listenerId = `paysheet_${paysheetId}`;
        if (this.listeners.has(listenerId)) {
            paysheetRef.off('value', this.listeners.get(listenerId));
        }

        const listener = paysheetRef.on('value', (snapshot) => {
            const paysheet = snapshot.exists() ? snapshot.val() : null;
            callback(paysheet);
        });

        this.listeners.set(listenerId, listener);
        return () => paysheetRef.off('value', listener);
    }

    /**
     * Import paysheet data with batch operations
     */
    async importPaysheetData(csvData, month, year) {
        if (!this.initialized) throw new Error('Firebase DB not initialized');

        try {
            const processedData = [];
            const batch = {};

            // Process CSV data
            for (let i = 1; i < csvData.length; i++) {
                const row = csvData[i];
                if (row.length < 10) continue;

                const record = {
                    teacherId: row[0] || '',
                    teacherName: row[1] || '',
                    designation: row[2] || '',
                    department: row[3] || '',
                    basicSalary: parseFloat(row[4]) || 0,
                    hra: parseFloat(row[5]) || 0,
                    da: parseFloat(row[6]) || 0,
                    allowances: parseFloat(row[7]) || 0,
                    grossSalary: parseFloat(row[8]) || 0,
                    pf: parseFloat(row[9]) || 0,
                    esi: parseFloat(row[10]) || 0,
                    tax: parseFloat(row[11]) || 0,
                    otherDeductions: parseFloat(row[12]) || 0,
                    totalDeductions: parseFloat(row[13]) || 0,
                    netPay: parseFloat(row[14]) || 0,
                    payDate: row[15] || new Date().toISOString().split('T')[0],
                    status: row[16] || 'Paid',
                    month: month,
                    year: year,
                    monthNum: this.getMonthNumber(month),
                    id: `${row[0]}_${month}_${year}`,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                };

                processedData.push(record);

                // Add to batch for salary slips
                batch[`salarySlips/${record.id}`] = record;
            }

            // Create paysheet
            const paysheetId = `${month}_${year}`;
            const summary = {
                totalTeachers: processedData.length,
                totalGross: processedData.reduce((sum, record) => sum + record.grossSalary, 0),
                totalDeductions: processedData.reduce((sum, record) => sum + record.totalDeductions, 0),
                totalNet: processedData.reduce((sum, record) => sum + record.netPay, 0)
            };

            batch[`paysheets/${paysheetId}`] = {
                id: paysheetId,
                month: month,
                year: year,
                records: processedData.reduce((acc, record) => {
                    acc[record.teacherId] = record;
                    return acc;
                }, {}),
                summary: summary,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            // Execute batch update
            await this.db.ref().update(batch);
            
            console.log(`✅ Imported ${processedData.length} paysheet records for ${month} ${year}`);
            return processedData;
        } catch (error) {
            console.error('Error importing paysheet data:', error);
            throw error;
        }
    }

    /**
     * Listen to real-time changes across all collections
     */
    onDataChange(path, callback) {
        if (!this.initialized) throw new Error('Firebase DB not initialized');

        const ref = this.db.ref(path);
        const listener = ref.on('value', callback);
        
        this.listeners.set(path, listener);
        return () => ref.off('value', listener);
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return this.db.ref().push().key;
    }

    /**
     * Get month number from month name
     */
    getMonthNumber(monthName) {
        const months = {
            'January': '01', 'February': '02', 'March': '03', 'April': '04',
            'May': '05', 'June': '06', 'July': '07', 'August': '08',
            'September': '09', 'October': '10', 'November': '11', 'December': '12'
        };
        return months[monthName] || '01';
    }

    /**
     * Clean up all listeners
     */
    cleanup() {
        this.listeners.forEach((listener, path) => {
            this.db.ref(path).off('value', listener);
        });
        this.listeners.clear();
        console.log('✅ Firebase listeners cleaned up');
    }

    /**
     * Get paysheet data for all months
     */
    getPaysheetData(callback) {
        if (!this.initialized) throw new Error('Firebase DB not initialized');
        
        const paysheetRef = this.db.ref('paysheets');
        
        if (this.listeners.has('paysheets')) {
            paysheetRef.off('value', this.listeners.get('paysheets'));
        }

        const listener = paysheetRef.on('value', (snapshot) => {
            const paysheetData = {};
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(key => {
                    const paysheet = data[key];
                    if (paysheet && paysheet.month) {
                        paysheetData[paysheet.month] = {
                            records: paysheet.records ? Object.values(paysheet.records) : [],
                            uploadDate: paysheet.createdAt,
                            recordsCount: paysheet.summary ? paysheet.summary.totalTeachers : 0
                        };
                    }
                });
            }
            callback(paysheetData);
        });

        this.listeners.set('paysheets', listener);
        return () => paysheetRef.off('value', listener);
    }

    /**
     * Check connection status
     */
    onConnectionChange(callback) {
        const connectedRef = this.db.ref('.info/connected');
        return connectedRef.on('value', (snapshot) => {
            callback(snapshot.val() === true);
        });
    }
}

// Export for use in other modules
window.FirebaseDB = FirebaseDB;
