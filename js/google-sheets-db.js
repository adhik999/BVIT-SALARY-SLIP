/**
 * Google Sheets Database Integration for TeacherPay Pro
 * This module handles all Google Sheets API operations
 */

class GoogleSheetsDB {
    constructor(config) {
        this.apiKey = config?.API_KEY || '';
        this.spreadsheetId = config?.SPREADSHEET_ID || '';
        this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
        this.initialized = false;
        this.isInitialized = false;
    }

    /**
     * Initialize the Google Sheets connection
     */
    async initialize() {
        if (!this.apiKey || !this.spreadsheetId) {
            console.log('Google Sheets configuration missing, skipping initialization');
            return false;
        }
        
        try {
            // Test connection by getting spreadsheet info
            const response = await fetch(`${this.baseUrl}/${this.spreadsheetId}?key=${this.apiKey}`);
            if (response.ok) {
                this.initialized = true;
                this.isInitialized = true;
                console.log('Google Sheets DB initialized successfully');
                return true;
            } else {
                throw new Error(`Failed to connect: ${response.status}`);
            }
        } catch (error) {
            // Suppress 403 errors to avoid console spam
            if (!error.message.includes('403')) {
                console.error('Failed to initialize Google Sheets DB:', error);
            }
            this.initialized = false;
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Read data from a specific sheet range
     * @param {string} range - Sheet range (e.g., 'Teachers!A:Z')
     */
    async readData(range) {
        if (!this.initialized) {
            throw new Error('Google Sheets DB not initialized');
        }

        try {
            const url = `${this.baseUrl}/${this.spreadsheetId}/values/${range}?key=${this.apiKey}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data.values || [];
        } catch (error) {
            console.error('Error reading data from Google Sheets:', error);
            throw error;
        }
    }

    /**
     * Write data to a specific sheet range
     * @param {string} range - Sheet range (e.g., 'Teachers!A2:Z2')
     * @param {Array} values - Array of values to write
     */
    async writeData(range, values) {
        if (!this.initialized) {
            throw new Error('Google Sheets DB not initialized');
        }

        try {
            const url = `${this.baseUrl}/${this.spreadsheetId}/values/${range}?valueInputOption=RAW&key=${this.apiKey}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: [values]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error writing data to Google Sheets:', error);
            throw error;
        }
    }

    /**
     * Append data to a sheet
     * @param {string} range - Sheet range (e.g., 'Teachers!A:Z')
     * @param {Array} values - Array of values to append
     */
    async appendData(range, values) {
        if (!this.initialized) {
            throw new Error('Google Sheets DB not initialized');
        }

        try {
            const url = `${this.baseUrl}/${this.spreadsheetId}/values/${range}:append?valueInputOption=RAW&key=${this.apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: [values]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error appending data to Google Sheets:', error);
            throw error;
        }
    }

    /**
     * Get all teachers from the Teachers sheet
     */
    async getTeachers() {
        try {
            const data = await this.readData('Teachers!A:Z');
            if (data.length === 0) return [];

            const headers = data[0];
            const teachers = [];

            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                const teacher = {};
                headers.forEach((header, index) => {
                    teacher[header] = row[index] || '';
                });
                teachers.push(teacher);
            }

            return teachers;
        } catch (error) {
            console.error('Error getting teachers:', error);
            return [];
        }
    }

    /**
     * Add a new teacher to the Teachers sheet
     * @param {Object} teacher - Teacher data object
     */
    async addTeacher(teacher) {
        // First ensure the Teachers sheet exists with proper headers
        await this.ensureTeachersSheetStructure();
        
        const range = 'Teachers!A:K';
        const values = [[
            teacher.id,
            teacher.name,
            teacher.email,
            teacher.phone,
            teacher.designation,
            teacher.department,
            teacher.status,
            teacher.registrationDate || new Date().toISOString(),
            teacher.approvedBy || '',
            teacher.approvalDate || '',
            teacher.employmentType || 'Permanent'
        ]];
        
        return await this.appendData(range, values);
    }

    /**
     * Ensure Teachers sheet exists with proper structure
     */
    async ensureTeachersSheetStructure() {
        try {
            // Check if Teachers sheet exists and has headers
            const response = await fetch(`${this.baseUrl}/${this.spreadsheetId}/values/Teachers!A1:K1?key=${this.apiKey}`);
            
            if (response.status === 400) {
                // Sheet doesn't exist, create it
                console.log('Creating Teachers sheet...');
                await this.createTeachersSheet();
            } else if (response.ok) {
                const data = await response.json();
                if (!data.values || data.values.length === 0) {
                    // Sheet exists but no headers, add them
                    console.log('Adding headers to Teachers sheet...');
                    await this.addTeachersHeaders();
                }
            }
        } catch (error) {
            console.error('Error ensuring Teachers sheet structure:', error);
        }
    }

    /**
     * Create Teachers sheet with headers
     */
    async createTeachersSheet() {
        try {
            // First create the sheet
            const createSheetResponse = await fetch(`${this.baseUrl}/${this.spreadsheetId}:batchUpdate?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requests: [{
                        addSheet: {
                            properties: {
                                title: 'Teachers'
                            }
                        }
                    }]
                })
            });

            if (createSheetResponse.ok) {
                console.log('✅ Teachers sheet created');
                // Add headers
                await this.addTeachersHeaders();
            }
        } catch (error) {
            console.error('Error creating Teachers sheet:', error);
        }
    }

    /**
     * Add headers to Teachers sheet
     */
    async addTeachersHeaders() {
        const headers = [['ID', 'Name', 'Email', 'Phone', 'Designation', 'Department', 'Status', 'Registration Date', 'Approved By', 'Approval Date', 'Employment Type']];
        
        try {
            const response = await fetch(`${this.baseUrl}/${this.spreadsheetId}/values/Teachers!A1:K1?valueInputOption=RAW&key=${this.apiKey}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: headers
                })
            });

            if (response.ok) {
                console.log('✅ Teachers sheet headers added');
            }
        } catch (error) {
            console.error('Error adding Teachers sheet headers:', error);
        }
    }

    /**
     * Update teacher status (approve/reject)
     * @param {string} teacherId - Teacher ID
     * @param {string} status - New status (approved/rejected)
     * @param {string} approvedBy - Admin who approved
     */
    async updateTeacherStatus(teacherId, status, approvedBy) {
        try {
            const teachers = await this.readData('Teachers!A:Z');
            if (teachers.length === 0) return false;

            const headers = teachers[0];
            const statusIndex = headers.indexOf('status');
            const approvedByIndex = headers.indexOf('approvedBy');
            const approvedAtIndex = headers.indexOf('approvedAt');
            const idIndex = headers.indexOf('id');

            for (let i = 1; i < teachers.length; i++) {
                if (teachers[i][idIndex] === teacherId) {
                    const rowNumber = i + 1;
                    
                    // Update status
                    if (statusIndex !== -1) {
                        await this.writeData(`Teachers!${this.getColumnLetter(statusIndex)}${rowNumber}`, [status]);
                    }
                    
                    // Update approved by
                    if (approvedByIndex !== -1) {
                        await this.writeData(`Teachers!${this.getColumnLetter(approvedByIndex)}${rowNumber}`, [approvedBy]);
                    }
                    
                    // Update approved at
                    if (approvedAtIndex !== -1) {
                        await this.writeData(`Teachers!${this.getColumnLetter(approvedAtIndex)}${rowNumber}`, [new Date().toISOString()]);
                    }
                    
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error updating teacher status:', error);
            throw error;
        }
    }

    /**
     * Get salary slips for a specific teacher
     * @param {string} teacherId - Teacher ID
     */
    async getSalarySlips(teacherId) {
        try {
            const data = await this.readData('SalarySlips!A:Z');
            if (data.length === 0) return [];

            const headers = data[0];
            const salarySlips = [];

            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                const slip = {};
                headers.forEach((header, index) => {
                    slip[header] = row[index] || '';
                });
                
                if (slip.teacherId === teacherId) {
                    salarySlips.push(slip);
                }
            }

            return salarySlips;
        } catch (error) {
            console.error('Error getting salary slips:', error);
            return [];
        }
    }

    /**
     * Add a new salary slip
     * @param {Object} salarySlip - Salary slip data object
     */
    async addSalarySlip(salarySlip) {
        try {
            const values = [
                salarySlip.id || '',
                salarySlip.teacherId || '',
                salarySlip.month || '',
                salarySlip.year || '',
                salarySlip.monthNum || '',
                salarySlip.payDate || '',
                salarySlip.grossSalary || 0,
                salarySlip.basicSalary || 0,
                salarySlip.hra || 0,
                salarySlip.da || 0,
                salarySlip.allowances || 0,
                salarySlip.pf || 0,
                salarySlip.esi || 0,
                salarySlip.tax || 0,
                salarySlip.otherDeductions || 0,
                salarySlip.totalDeductions || 0,
                salarySlip.netPay || 0,
                salarySlip.status || 'paid',
                salarySlip.createdAt || new Date().toISOString()
            ];

            return await this.appendData('SalarySlips!A:S', values);
        } catch (error) {
            console.error('Error adding salary slip:', error);
            throw error;
        }
    }

    /**
     * Helper function to convert column index to letter
     * @param {number} index - Column index (0-based)
     */
    getColumnLetter(index) {
        let letter = '';
        while (index >= 0) {
            letter = String.fromCharCode(65 + (index % 26)) + letter;
            index = Math.floor(index / 26) - 1;
        }
        return letter;
    }

    /**
     * Create the initial sheet structure if it doesn't exist
     */
    async setupSheets() {
        try {
            // Setup Teachers sheet headers
            const teacherHeaders = [
                'id', 'name', 'email', 'phone', 'designation', 
                'department', 'joiningDate', 'status', 'createdAt', 
                'approvedBy', 'approvedAt'
            ];
            
            // Setup SalarySlips sheet headers
            const salarySlipHeaders = [
                'id', 'teacherId', 'month', 'year', 'monthNum', 'payDate',
                'grossSalary', 'basicSalary', 'hra', 'da', 'allowances',
                'pf', 'esi', 'tax', 'otherDeductions', 'totalDeductions',
                'netPay', 'status', 'createdAt'
            ];

            // Write headers (this will create the sheets if they don't exist)
            await this.writeData('Teachers!A1:K1', teacherHeaders);
            await this.writeData('SalarySlips!A1:S1', salarySlipHeaders);

            console.log('Google Sheets structure setup completed');
            return true;
        } catch (error) {
            console.error('Error setting up sheets:', error);
            return false;
        }
    }

    /**
     * Create monthly paysheet view in Google Sheets
     * @param {string} month - Month name (e.g., 'January')
     * @param {string} year - Year (e.g., '2025')
     * @param {Array} paysheetData - Array of paysheet records
     */
    async createMonthlyPaysheetView(month, year, paysheetData) {
        try {
            const sheetName = `${month}_${year}_Paysheet`;
            
            // Create headers for monthly paysheet view
            const headers = [
                'Sr.No', 'Teacher ID', 'Teacher Name', 'Designation', 'Department',
                'Basic Salary', 'HRA', 'DA', 'Allowances', 'Gross Salary',
                'PF', 'ESI', 'Tax', 'Other Deductions', 'Total Deductions',
                'Net Pay', 'Pay Date', 'Status'
            ];

            // Write headers
            await this.writeData(`${sheetName}!A1:R1`, headers);

            // Format headers (make them bold and add background color)
            await this.formatHeaders(sheetName, 'A1:R1');

            // Prepare data rows
            const dataRows = [];
            paysheetData.forEach((record, index) => {
                const row = [
                    index + 1, // Sr.No
                    record.teacherId || '',
                    record.teacherName || '',
                    record.designation || '',
                    record.department || '',
                    record.basicSalary || 0,
                    record.hra || 0,
                    record.da || 0,
                    record.allowances || 0,
                    record.grossSalary || 0,
                    record.pf || 0,
                    record.esi || 0,
                    record.tax || 0,
                    record.otherDeductions || 0,
                    record.totalDeductions || 0,
                    record.netPay || 0,
                    record.payDate || '',
                    record.status || 'Paid'
                ];
                dataRows.push(row);
            });

            // Write data rows
            if (dataRows.length > 0) {
                const range = `${sheetName}!A2:R${dataRows.length + 1}`;
                await this.writeBatchData(range, dataRows);
            }

            // Add summary row
            await this.addSummaryRow(sheetName, dataRows.length + 2, paysheetData);

            console.log(`Monthly paysheet view created: ${sheetName}`);
            return sheetName;
        } catch (error) {
            console.error('Error creating monthly paysheet view:', error);
            throw error;
        }
    }

    /**
     * Write multiple rows of data at once
     * @param {string} range - Sheet range
     * @param {Array} dataRows - Array of data rows
     */
    async writeBatchData(range, dataRows) {
        if (!this.initialized) {
            throw new Error('Google Sheets DB not initialized');
        }

        try {
            const url = `${this.baseUrl}/${this.spreadsheetId}/values/${range}?valueInputOption=RAW&key=${this.apiKey}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: dataRows
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error writing batch data to Google Sheets:', error);
            throw error;
        }
    }

    /**
     * Add summary row with totals
     * @param {string} sheetName - Sheet name
     * @param {number} rowNumber - Row number for summary
     * @param {Array} paysheetData - Paysheet data for calculations
     */
    async addSummaryRow(sheetName, rowNumber, paysheetData) {
        try {
            const totalGross = paysheetData.reduce((sum, record) => sum + (parseFloat(record.grossSalary) || 0), 0);
            const totalDeductions = paysheetData.reduce((sum, record) => sum + (parseFloat(record.totalDeductions) || 0), 0);
            const totalNet = paysheetData.reduce((sum, record) => sum + (parseFloat(record.netPay) || 0), 0);

            const summaryRow = [
                '', '', 'TOTAL', '', '',
                '', '', '', '', totalGross,
                '', '', '', '', totalDeductions,
                totalNet, '', ''
            ];

            await this.writeData(`${sheetName}!A${rowNumber}:R${rowNumber}`, summaryRow);
            
            // Format summary row (make it bold)
            await this.formatSummaryRow(sheetName, `A${rowNumber}:R${rowNumber}`);
        } catch (error) {
            console.error('Error adding summary row:', error);
        }
    }

    /**
     * Format headers (placeholder - would need Google Sheets API v4 with proper authentication)
     */
    async formatHeaders(sheetName, range) {
        // Note: Formatting requires more advanced API calls with proper authentication
        // For now, this is a placeholder
        console.log(`Formatting headers for ${sheetName} range ${range}`);
    }

    /**
     * Format summary row (placeholder)
     */
    async formatSummaryRow(sheetName, range) {
        // Note: Formatting requires more advanced API calls with proper authentication
        console.log(`Formatting summary row for ${sheetName} range ${range}`);
    }

    /**
     * Import paysheet data from CSV/Excel format
     * @param {Array} csvData - Parsed CSV data
     * @param {string} month - Month name
     * @param {string} year - Year
     */
    async importPaysheetData(csvData, month, year) {
        try {
            const processedData = [];
            
            // Skip header row and process data
            for (let i = 1; i < csvData.length; i++) {
                const row = csvData[i];
                if (row.length < 10) continue; // Skip incomplete rows

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
                    createdAt: new Date().toISOString()
                };

                processedData.push(record);

                // Also add to SalarySlips sheet
                await this.addSalarySlip(record);
            }

            // Create monthly view sheet
            await this.createMonthlyPaysheetView(month, year, processedData);

            console.log(`Imported ${processedData.length} paysheet records for ${month} ${year}`);
            return processedData;
        } catch (error) {
            console.error('Error importing paysheet data:', error);
            throw error;
        }
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
}

// Export for use in other modules
window.GoogleSheetsDB = GoogleSheetsDB;
