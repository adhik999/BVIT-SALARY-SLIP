/**
 * Paysheet Importer Utility
 * Handles CSV/Excel file import and processing for monthly paysheets
 */

class PaysheetImporter {
    constructor() {
        this.supportedFormats = ['.csv', '.xlsx', '.xls'];
        this.firebaseDB = null;
    }

    /**
     * Initialize with Firebase DB instance
     */
    initialize(firebaseDB) {
        this.firebaseDB = firebaseDB;
    }

    /**
     * Parse CSV file content
     * @param {string} csvContent - Raw CSV content
     */
    parseCSV(csvContent) {
        const lines = csvContent.split('\n');
        const result = [];
        
        for (let line of lines) {
            if (line.trim()) {
                // Simple CSV parsing - handles basic cases
                const row = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
                result.push(row);
            }
        }
        
        return result;
    }

    /**
     * Parse Excel file content
     * @param {ArrayBuffer} excelBuffer - Excel file buffer
     */
    parseExcel(excelBuffer) {
        try {
            const workbook = XLSX.read(excelBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to array of arrays (same format as CSV)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            return jsonData;
        } catch (error) {
            throw new Error('Failed to parse Excel file: ' + error.message);
        }
    }

    /**
     * Validate paysheet data format
     * @param {Array} data - Parsed data array
     */
    validatePaysheetData(data) {
        if (!data || data.length < 2) {
            throw new Error('File must contain at least header row and one data row');
        }

        const headers = data[0];
        
        // More flexible column matching - check for common variations
        const requiredColumns = [
            {
                name: 'Teacher ID',
                patterns: ['teacher_id', 'teacherid', 'id', 'emp_id', 'employee_id', 'staff_id']
            },
            {
                name: 'Teacher Name', 
                patterns: ['teacher_name', 'teachername', 'name', 'employee_name', 'staff_name', 'full_name']
            },
            {
                name: 'Basic Salary',
                patterns: ['basic_salary', 'basicsalary', 'basic', 'base_salary', 'salary']
            }
        ];

        // Normalize headers for comparison
        const normalizedHeaders = headers.map(h => 
            h.toLowerCase().replace(/[\s\-_\.]/g, '').trim()
        );

        // Check if at least the essential columns exist
        for (let required of requiredColumns) {
            const found = normalizedHeaders.some(header => 
                required.patterns.some(pattern => 
                    header.includes(pattern.replace(/[\s\-_\.]/g, '')) ||
                    pattern.replace(/[\s\-_\.]/g, '').includes(header)
                )
            );
            
            if (!found) {
                console.warn(`Recommended column "${required.name}" not found. Available headers:`, headers);
                // Don't throw error for missing columns - just warn
            }
        }

        return true;
    }

    /**
     * Process and import paysheet file
     * @param {File} file - File object from input
     * @param {string} month - Month name
     * @param {string} year - Year
     */
    async importPaysheetFile(file, month, year) {
        try {
            const fileContent = await this.readFile(file);
            let parsedData;

            if (file.name.toLowerCase().endsWith('.csv')) {
                parsedData = this.parseCSV(fileContent);
            } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
                parsedData = this.parseExcel(fileContent);
            } else {
                throw new Error('Unsupported file format. Please use CSV or Excel files (.csv, .xlsx, .xls).');
            }

            // Validate data format
            this.validatePaysheetData(parsedData);

            // Save to Firebase database
            try {
                // Initialize Firebase if not already initialized
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                
                const firebaseDB = new FirebaseDB();
                
                // Create paysheet data structure
                const paysheetKey = `${month}_${year}`;
                const processedData = this.processDataForLocalStorage(parsedData, month, year);
                const paysheetData = {
                    month,
                    year,
                    monthNum: this.getMonthNumber(month),
                    importDate: new Date().toISOString(),
                    records: {},
                    summary: {
                        totalRecords: processedData.length,
                        totalGross: processedData.reduce((sum, record) => sum + record.grossSalary, 0),
                        totalDeductions: processedData.reduce((sum, record) => sum + record.totalDeductions, 0),
                        totalNet: processedData.reduce((sum, record) => sum + record.netPay, 0)
                    }
                };
                
                // Convert records array to object with teacherId as key
                processedData.forEach(record => {
                    paysheetData.records[record.teacherId] = record;
                });
                
                // Save paysheet to Firebase
                const paysheetRef = firebase.database().ref(`paysheets/${paysheetKey}`);
                await paysheetRef.set(paysheetData);
                
                // Also save individual salary slips for each teacher
                const salarySlipsRef = firebase.database().ref('salarySlips');
                
                for (const record of processedData) {
                    const slipId = `${record.teacherId}_${month}_${year}`;
                    const salarySlip = {
                        id: slipId,
                        teacherId: record.teacherId,
                        teacherName: record.teacherName,
                        month,
                        year,
                        monthNum: this.getMonthNumber(month),
                        payDate: record.payDate,
                        designation: record.designation,
                        department: record.department,
                        basicSalary: record.basicSalary,
                        hra: record.hra,
                        da: record.da,
                        allowances: record.allowances,
                        grossSalary: record.grossSalary,
                        pf: record.pf,
                        esi: record.esi,
                        tax: record.tax,
                        otherDeductions: record.otherDeductions,
                        totalDeductions: record.totalDeductions,
                        netPay: record.netPay,
                        status: record.status || 'Generated',
                        createdAt: new Date().toISOString(),
                        paysheetId: paysheetKey
                    };
                    
                    await salarySlipsRef.child(slipId).set(salarySlip);
                }
                
                console.log('✅ Paysheet data and salary slips saved to Firebase successfully');
                
                // Also save to localStorage as backup
                const localPaysheetKey = `paysheet_${month}_${year}`;
                localStorage.setItem(localPaysheetKey, JSON.stringify(paysheetData));
                
                return {
                    success: true,
                    message: `Successfully imported ${processedData.length} paysheet records to Firebase database`,
                    data: processedData,
                    paysheetId: paysheetKey
                };
                
            } catch (error) {
                console.error('Firebase import error:', error);
                
                // Fallback: Save to localStorage only
                const paysheetKey = `paysheet_${month}_${year}`;
                const processedData = this.processDataForLocalStorage(parsedData, month, year);
                const paysheetData = {
                    month,
                    year,
                    importDate: new Date().toISOString(),
                    records: processedData,
                    summary: {
                        totalRecords: processedData.length,
                        totalGross: processedData.reduce((sum, record) => sum + record.grossSalary, 0),
                        totalDeductions: processedData.reduce((sum, record) => sum + record.totalDeductions, 0),
                        totalNet: processedData.reduce((sum, record) => sum + record.netPay, 0)
                    }
                };

                localStorage.setItem(paysheetKey, JSON.stringify(paysheetData));
                console.log('⚠️ Firebase failed, paysheet data saved to localStorage');

                return {
                    success: true,
                    message: `Successfully imported ${processedData.length} paysheet records to local storage (Firebase backup failed)`,
                    data: processedData,
                    paysheetId: null
                };
            }
        } catch (error) {
            console.error('Error importing paysheet file:', error);
            return {
                success: false,
                message: error.message,
                data: null
            };
        }
    }

    /**
     * Read file content
     * @param {File} file - File object
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            if (file.name.toLowerCase().endsWith('.csv')) {
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read CSV file'));
                reader.readAsText(file);
            } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read Excel file'));
                reader.readAsArrayBuffer(file);
            } else {
                reject(new Error('Unsupported file format'));
            }
        });
    }

    /**
     * Process data for localStorage storage with exact Excel column mapping
     * @param {Array} csvData - Parsed CSV data
     * @param {string} month - Month name
     * @param {string} year - Year
     */
    processDataForLocalStorage(csvData, month, year) {
        const processedData = [];
        
        if (csvData.length < 2) return processedData;
        
        // Get headers from first row and create column mapping
        const headers = csvData[0];
        const columnMap = {};
        
        // Map exact Excel column headers to field names
        headers.forEach((header, index) => {
            const normalizedHeader = header.toString().toLowerCase().trim();
            
            // Map based on exact Excel column names from the image
            if (normalizedHeader.includes('teacher') && normalizedHeader.includes('id')) {
                columnMap.teacherId = index;
            } else if (normalizedHeader.includes('name') && normalizedHeader.includes('staff')) {
                columnMap.teacherName = index;
            } else if (normalizedHeader.includes('designation')) {
                columnMap.designation = index;
            } else if (normalizedHeader.includes('qualification')) {
                columnMap.qualification = index;
            } else if (normalizedHeader.includes('pay scale') || normalizedHeader.includes('payscale')) {
                columnMap.payScale = index;
            } else if (normalizedHeader.includes('pay') && normalizedHeader.includes('band')) {
                columnMap.payBand = index;
            } else if (normalizedHeader.includes('a.g.p') || normalizedHeader.includes('agp')) {
                columnMap.agp = index;
            } else if (normalizedHeader.includes('revised') && normalizedHeader.includes('basic')) {
                columnMap.revisedBasicPay = index;
            } else if (normalizedHeader.includes('d.a') && normalizedHeader.includes('150')) {
                columnMap.da150 = index;
            } else if (normalizedHeader.includes('h.r.a') && normalizedHeader.includes('30')) {
                columnMap.hra30 = index;
            } else if (normalizedHeader.includes('c.l.a')) {
                columnMap.cla = index;
            } else if (normalizedHeader.includes('add') && normalizedHeader.includes('allowance')) {
                columnMap.addAllowance = index;
            } else if (normalizedHeader.includes('gross') && normalizedHeader.includes('total')) {
                columnMap.grossTotal = index;
            } else if (normalizedHeader.includes('prof') && normalizedHeader.includes('tax')) {
                columnMap.profTax = index;
            } else if (normalizedHeader.includes('income') && normalizedHeader.includes('tax')) {
                columnMap.incomeTax = index;
            } else if (normalizedHeader.includes('p.f') || normalizedHeader === 'pf') {
                columnMap.pf = index;
            } else if (normalizedHeader.includes('lic')) {
                columnMap.lic = index;
            } else if (normalizedHeader.includes('medical') && normalizedHeader.includes('insur')) {
                columnMap.medicalInsurance = index;
            } else if (normalizedHeader.includes('ew') && normalizedHeader.includes('fund')) {
                columnMap.ewFund = index;
            } else if (normalizedHeader.includes('total') && normalizedHeader.includes('deduction')) {
                columnMap.totalDeductions = index;
            } else if (normalizedHeader.includes('net') && normalizedHeader.includes('pay')) {
                columnMap.netPay = index;
            }
        });
        
        console.log('📋 Column mapping created:', columnMap);
        console.log('📋 Excel headers:', headers);
        
        // Process data rows using column mapping
        for (let i = 1; i < csvData.length; i++) {
            const row = csvData[i];
            if (row.length < 3) continue; // Skip incomplete rows

            const record = {
                // Basic info
                id: `${row[columnMap.teacherId] || i}_${month}_${year}`,
                teacherId: row[columnMap.teacherId] || '',
                teacherName: row[columnMap.teacherName] || '',
                designation: row[columnMap.designation] || '',
                qualification: row[columnMap.qualification] || '',
                
                // Pay structure
                payScale: row[columnMap.payScale] || '',
                payBand: row[columnMap.payBand] || '',
                agp: parseFloat(row[columnMap.agp]) || 0,
                
                // Earnings - using exact Excel column names
                revisedBasicPay: parseFloat(row[columnMap.revisedBasicPay]) || 0,
                da150: parseFloat(row[columnMap.da150]) || 0,
                hra30: parseFloat(row[columnMap.hra30]) || 0,
                cla: parseFloat(row[columnMap.cla]) || 0,
                addAllowance: parseFloat(row[columnMap.addAllowance]) || 0,
                grossTotal: parseFloat(row[columnMap.grossTotal]) || 0,
                
                // Deductions - using exact Excel column names
                profTax: parseFloat(row[columnMap.profTax]) || 0,
                incomeTax: parseFloat(row[columnMap.incomeTax]) || 0,
                pf: parseFloat(row[columnMap.pf]) || 0,
                lic: parseFloat(row[columnMap.lic]) || 0,
                medicalInsurance: parseFloat(row[columnMap.medicalInsurance]) || 0,
                ewFund: parseFloat(row[columnMap.ewFund]) || 0,
                totalDeductions: parseFloat(row[columnMap.totalDeductions]) || 0,
                
                // Net pay
                netPay: parseFloat(row[columnMap.netPay]) || 0,
                
                // Legacy fields for compatibility
                basicSalary: parseFloat(row[columnMap.revisedBasicPay]) || 0,
                da: parseFloat(row[columnMap.da150]) || 0,
                hra: parseFloat(row[columnMap.hra30]) || 0,
                allowances: parseFloat(row[columnMap.addAllowance]) || 0,
                grossSalary: parseFloat(row[columnMap.grossTotal]) || 0,
                
                // Meta data
                payDate: new Date().toISOString().split('T')[0],
                status: 'paid',
                month: month,
                year: year,
                monthNum: this.getMonthNumber(month),
                createdAt: new Date().toISOString()
            };

            processedData.push(record);
        }

        console.log('✅ Processed data with exact Excel column mapping:', processedData.length, 'records');
        return processedData;
    }

    /**
     * Save processed data to localStorage
     * @param {Array} processedData - Processed paysheet data
     * @param {string} month - Month name
     * @param {string} year - Year
     */
    saveToLocalStorage(processedData, month, year) {
        // Add to existing salary slips
        const existingSlips = JSON.parse(localStorage.getItem('salarySlips') || '[]');
        const updatedSlips = [...existingSlips, ...processedData];
        localStorage.setItem('salarySlips', JSON.stringify(updatedSlips));

        // Save monthly view data
        const monthlyKey = `paysheet_${month}_${year}`;
        localStorage.setItem(monthlyKey, JSON.stringify(processedData));
    }

    /**
     * Get month number from month name
     * @param {string} monthName - Month name
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
     * Get sample CSV format for download
     */
    getSampleCSVFormat() {
        const headers = [
            'Teacher ID', 'Teacher Name', 'Designation', 'Department',
            'Basic Salary', 'HRA', 'DA', 'Allowances', 'Gross Salary',
            'PF', 'ESI', 'Tax', 'Other Deductions', 'Total Deductions',
            'Net Pay', 'Pay Date', 'Status'
        ];

        const sampleData = [
            ['T001', 'Dr. John Smith', 'Professor', 'Computer Science',
             '50000', '15000', '5000', '3000', '73000',
             '6000', '1000', '5000', '500', '12500',
             '60500', '2025-01-31', 'Paid'],
            ['T002', 'Ms. Jane Doe', 'Associate Professor', 'Mathematics',
             '45000', '13500', '4500', '2500', '65500',
             '5400', '900', '4000', '300', '10600',
             '54900', '2025-01-31', 'Paid']
        ];

        let csvContent = headers.join(',') + '\n';
        sampleData.forEach(row => {
            csvContent += row.join(',') + '\n';
        });

        return csvContent;
    }

    /**
     * Download sample CSV file
     */
    downloadSampleCSV() {
        const csvContent = this.getSampleCSVFormat();
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'paysheet_sample_format.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}

// Export for use in other modules
window.PaysheetImporter = PaysheetImporter;
