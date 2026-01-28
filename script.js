// ===================================
// STATE MANAGEMENT
// ===================================
let groceryList = [];
let isRecording = false;
let recognition = null;
let db = null; // Database instance

// ===================================
// DOM ELEMENTS
// ===================================
const elements = {
    voiceButton: document.getElementById('voiceButton'),
    whatsappButton: document.getElementById('whatsappButton'),
    clearButton: document.getElementById('clearButton'),
    addButton: document.getElementById('addButton'),
    manualInput: document.getElementById('manualInput'),
    groceryListEl: document.getElementById('groceryList'),
    emptyState: document.getElementById('emptyState'),
    itemCount: document.getElementById('itemCount'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    voiceModal: document.getElementById('voiceModal'),
    stopButton: document.getElementById('stopButton'),
    transcriptText: document.getElementById('transcriptText')
};

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    await initializeDatabase();
    await loadFromDatabase();
    initializeEventListeners();
    initializeSpeechRecognition();
    renderList();
});

// ===================================
// DATABASE FUNCTIONS
// ===================================
async function initializeDatabase() {
    try {
        db = new GroceryDatabase();
        await db.init();
        console.log('✅ Database initialized successfully');
        showToast('Database ready!');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        showToast('Database error - using memory only');
    }
}

async function loadFromDatabase() {
    try {
        if (db) {
            groceryList = await db.getAllItems();
            console.log('✅ Loaded', groceryList.length, 'items from database');
        }
    } catch (error) {
        console.error('❌ Error loading from database:', error);
        groceryList = [];
    }
}

async function saveToDatabase() {
    // This function is no longer needed as we save directly in add/update/delete
    // Kept for compatibility
}

// ===================================
// SPEECH RECOGNITION
// ===================================
function initializeSpeechRecognition() {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser');
        elements.voiceButton.disabled = true;
        elements.voiceButton.innerHTML = '<span class="button-text">Not Supported</span>';
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        console.log('Speech recognition started');
        isRecording = true;
        elements.voiceModal.classList.add('active');
        elements.transcriptText.textContent = 'Listening... Say the items you want to add';
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        // Display interim results
        if (interimTranscript) {
            elements.transcriptText.textContent = interimTranscript;
        }

        // Process final results
        if (finalTranscript) {
            processVoiceInput(finalTranscript.trim());
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopRecording();

        let errorMessage = 'Voice recognition error';
        if (event.error === 'no-speech') {
            errorMessage = 'No speech detected. Please try again.';
        } else if (event.error === 'not-allowed') {
            errorMessage = 'Microphone access denied. Please enable it in browser settings.';
        }

        showToast(errorMessage);
    };

    recognition.onend = () => {
        console.log('Speech recognition ended');
        if (isRecording) {
            // Restart if still in recording mode
            try {
                recognition.start();
            } catch (error) {
                console.error('Error restarting recognition:', error);
                stopRecording();
            }
        }
    };
}

function startRecording() {
    if (!recognition) {
        showToast('Speech recognition not available');
        return;
    }

    try {
        recognition.start();
        console.log('Starting speech recognition...');
    } catch (error) {
        console.error('Error starting recognition:', error);
        showToast('Could not start voice recording');
    }
}

function stopRecording() {
    if (recognition && isRecording) {
        isRecording = false;
        recognition.stop();
        elements.voiceModal.classList.remove('active');
        console.log('Stopped speech recognition');
    }
}

async function processVoiceInput(text) {
    console.log('Processing voice input:', text);

    // Split by common separators (and, comma, etc.)
    const items = text.split(/,|\band\b/i)
        .map(item => item.trim())
        .filter(item => item.length > 0);

    let addedCount = 0;

    for (const itemText of items) {
        // Clean up the item text
        const cleanItem = itemText
            .replace(/^(add|get|buy|need)\s+/i, '') // Remove command words
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();

        if (cleanItem && !isDuplicate(cleanItem)) {
            await addItem(cleanItem);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        showToast(`Added ${addedCount} item${addedCount > 1 ? 's' : ''}`);
    }
}

// ===================================
// ITEM MANAGEMENT
// ===================================
async function addItem(text) {
    const item = {
        id: Date.now() + Math.random(),
        text: text,
        checked: false,
        timestamp: new Date().toISOString()
    };

    try {
        if (db) {
            await db.addItem(item);
        }
        groceryList.unshift(item); // Add to beginning
        renderList();
        console.log('✅ Added item:', item);
    } catch (error) {
        console.error('❌ Error adding item:', error);
        showToast('Error adding item to database');
    }
}

async function deleteItem(id) {
    try {
        if (db) {
            await db.deleteItem(id);
        }
        groceryList = groceryList.filter(item => item.id !== id);
        renderList();
        showToast('Item removed');
    } catch (error) {
        console.error('❌ Error deleting item:', error);
        showToast('Error deleting item');
    }
}

async function toggleItem(id) {
    const item = groceryList.find(item => item.id === id);
    if (item) {
        item.checked = !item.checked;

        try {
            if (db) {
                await db.updateItem(item);
            }
            renderList();
        } catch (error) {
            console.error('❌ Error updating item:', error);
            showToast('Error updating item');
        }
    }
}

async function clearAllItems() {
    if (groceryList.length === 0) {
        showToast('List is already empty');
        return;
    }

    if (confirm('Are you sure you want to clear all items?')) {
        try {
            if (db) {
                await db.clearAll();
            }
            groceryList = [];
            renderList();
            showToast('List cleared');
        } catch (error) {
            console.error('❌ Error clearing database:', error);
            showToast('Error clearing list');
        }
    }
}

function isDuplicate(text) {
    const normalizedText = text.toLowerCase().trim();
    return groceryList.some(item =>
        item.text.toLowerCase().trim() === normalizedText
    );
}

// ===================================
// RENDERING
// ===================================
function renderList() {
    // Update count
    elements.itemCount.textContent = groceryList.length;

    // Show/hide empty state
    if (groceryList.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.groceryListEl.innerHTML = '';
        return;
    }

    elements.emptyState.classList.add('hidden');

    // Render items
    elements.groceryListEl.innerHTML = groceryList.map(item => `
        <li class="grocery-item" data-id="${item.id}">
            <div class="item-content">
                <div class="item-checkbox ${item.checked ? 'checked' : ''}" 
                     onclick="toggleItem(${item.id})">
                </div>
                <span class="item-text ${item.checked ? 'checked' : ''}">${escapeHtml(item.text)}</span>
            </div>
            <button class="delete-button" onclick="deleteItem(${item.id})" aria-label="Delete item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </li>
    `).join('');
}

// ===================================
// WHATSAPP INTEGRATION
// ===================================
function shareOnWhatsApp() {
    if (groceryList.length === 0) {
        showToast('Your list is empty. Add some items first!');
        return;
    }

    // Create formatted message
    let message = '🛒 *My Grocery List*\n\n';

    const uncheckedItems = groceryList.filter(item => !item.checked);
    const checkedItems = groceryList.filter(item => item.checked);

    if (uncheckedItems.length > 0) {
        message += '📝 *To Buy:*\n';
        uncheckedItems.forEach((item, index) => {
            message += `${index + 1}. ${item.text}\n`;
        });
    }

    if (checkedItems.length > 0) {
        message += '\n✅ *Already Got:*\n';
        checkedItems.forEach((item, index) => {
            message += `${index + 1}. ~~${item.text}~~\n`;
        });
    }

    message += `\n📊 Total Items: ${groceryList.length}`;
    message += `\n⏰ Generated: ${new Date().toLocaleString()}`;

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    // Open WhatsApp with the message
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');

    showToast('Opening WhatsApp...');
}

// ===================================
// EVENT LISTENERS
// ===================================
function initializeEventListeners() {
    // Voice button
    elements.voiceButton.addEventListener('click', startRecording);
    elements.stopButton.addEventListener('click', stopRecording);

    // WhatsApp button
    elements.whatsappButton.addEventListener('click', shareOnWhatsApp);

    // Clear button
    elements.clearButton.addEventListener('click', clearAllItems);

    // Manual input
    elements.addButton.addEventListener('click', handleManualAdd);
    elements.manualInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleManualAdd();
        }
    });

    // Close modal on background click
    elements.voiceModal.addEventListener('click', (e) => {
        if (e.target === elements.voiceModal) {
            stopRecording();
        }
    });
}

async function handleManualAdd() {
    const text = elements.manualInput.value.trim();

    if (!text) {
        showToast('Please enter an item');
        return;
    }

    if (isDuplicate(text)) {
        showToast('Item already in list');
        elements.manualInput.value = '';
        return;
    }

    await addItem(text);
    elements.manualInput.value = '';
    showToast('Item added');
}

// ===================================
// UTILITY FUNCTIONS
// ===================================
function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===================================
// DATABASE UTILITIES (Exposed to Console)
// ===================================
window.groceryDB = {
    // Get database statistics
    async getStats() {
        if (db) {
            const stats = await db.getStats();
            console.table(stats);
            return stats;
        }
    },

    // Export database to JSON
    async export() {
        if (db) {
            const json = await db.exportToJSON();
            console.log('Database export:', json);

            // Download as file
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `grocery-list-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            showToast('Database exported!');
            return json;
        }
    },

    // Import database from JSON
    async import(jsonString) {
        if (db) {
            const count = await db.importFromJSON(jsonString);
            await loadFromDatabase();
            renderList();
            showToast(`Imported ${count} items!`);
            return count;
        }
    },

    // Search items
    async search(text) {
        if (db) {
            const results = await db.searchItems(text);
            console.log('Search results:', results);
            return results;
        }
    },

    // Get checked items
    async getChecked() {
        if (db) {
            return await db.getItemsByStatus(true);
        }
    },

    // Get unchecked items
    async getUnchecked() {
        if (db) {
            return await db.getItemsByStatus(false);
        }
    }
};

// ===================================
// GLOBAL FUNCTIONS (for inline handlers)
// ===================================
window.toggleItem = toggleItem;
window.deleteItem = deleteItem;

// ===================================
// SERVICE WORKER (Optional - for PWA)
// ===================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable PWA functionality
        // navigator.serviceWorker.register('/sw.js')
        //     .then(reg => console.log('Service Worker registered'))
        //     .catch(err => console.log('Service Worker registration failed'));
    });
}

console.log('🛒 Smart Grocery List App initialized with IndexedDB ✓');
console.log('💡 Try: groceryDB.getStats() to see database statistics');
console.log('💡 Try: groceryDB.export() to download your data');
