/**
 * DHWS Data Injector - Firebase Mode
 * Disabled when Firebase is available
 */

(function() {
    'use strict';
    
    // Check if Firebase is available and properly configured
    const isFirebaseAvailable = typeof firebase !== 'undefined' && firebase.database;
    
    // Skip all localStorage operations if Firebase is available
    if (isFirebaseAvailable) {
        console.log('🔥 Firebase detected - skipping DHWS Data Injector localStorage operations');
        return;
    }
    
    console.log('🚀 DHWS Data Injector disabled - Firebase is handling all data operations');
})();
