/**
 * API Client for TeacherPay Pro Server
 * Handles all server communication for Google Sheets operations
 */

class TeacherPayAPI {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
        this.initialized = false;
    }

    async initialize() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            if (response.ok) {
                const data = await response.json();
                this.initialized = data.googleSheets;
                console.log('✅ TeacherPay API connected. Google Sheets:', this.initialized ? 'Ready' : 'Not Available');
                return true;
            }
        } catch (error) {
            console.log('⚠️ Server not available, using localStorage only');
            this.initialized = false;
        }
        return false;
    }

    async getTeachers() {
        if (!this.initialized) {
            throw new Error('API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/teachers`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching teachers:', error);
            throw error;
        }
    }

    async addTeacher(teacherData) {
        if (!this.initialized) {
            throw new Error('API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/teachers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(teacherData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error adding teacher:', error);
            throw error;
        }
    }

    async updateTeacher(teacherId, updates) {
        if (!this.initialized) {
            throw new Error('API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/teachers/${teacherId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating teacher:', error);
            throw error;
        }
    }

    async approveTeacher(teacherId, approvedBy) {
        return this.updateTeacher(teacherId, {
            status: 'Approved',
            approvedBy: approvedBy,
            approvalDate: new Date().toISOString()
        });
    }

    async rejectTeacher(teacherId, rejectedBy) {
        return this.updateTeacher(teacherId, {
            status: 'Rejected',
            approvedBy: rejectedBy,
            approvalDate: new Date().toISOString()
        });
    }
}

// Global instance
window.teacherPayAPI = new TeacherPayAPI();
