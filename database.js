// ===================================
// INDEXEDDB DATABASE MANAGER
// ===================================

class GroceryDatabase {
    constructor() {
        this.dbName = 'GroceryListDB';
        this.dbVersion = 1;
        this.storeName = 'groceryItems';
        this.db = null;
    }

    // Initialize database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Database failed to open:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: false
                    });

                    // Create indexes for efficient querying
                    objectStore.createIndex('text', 'text', { unique: false });
                    objectStore.createIndex('checked', 'checked', { unique: false });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });

                    console.log('✅ Database structure created');
                }
            };
        });
    }

    // Add item to database
    async addItem(item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.add(item);

            request.onsuccess = () => {
                console.log('✅ Item added to database:', item);
                resolve(item);
            };

            request.onerror = () => {
                console.error('❌ Error adding item:', request.error);
                reject(request.error);
            };
        });
    }

    // Get all items from database
    async getAllItems() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                console.log('✅ Retrieved items from database:', request.result.length);
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('❌ Error getting items:', request.error);
                reject(request.error);
            };
        });
    }

    // Get item by ID
    async getItem(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Update item in database
    async updateItem(item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(item);

            request.onsuccess = () => {
                console.log('✅ Item updated in database:', item);
                resolve(item);
            };

            request.onerror = () => {
                console.error('❌ Error updating item:', request.error);
                reject(request.error);
            };
        });
    }

    // Delete item from database
    async deleteItem(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(id);

            request.onsuccess = () => {
                console.log('✅ Item deleted from database:', id);
                resolve(id);
            };

            request.onerror = () => {
                console.error('❌ Error deleting item:', request.error);
                reject(request.error);
            };
        });
    }

    // Clear all items from database
    async clearAll() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.clear();

            request.onsuccess = () => {
                console.log('✅ All items cleared from database');
                resolve();
            };

            request.onerror = () => {
                console.error('❌ Error clearing database:', request.error);
                reject(request.error);
            };
        });
    }

    // Get items by checked status
    async getItemsByStatus(checked) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const index = objectStore.index('checked');
            const request = index.getAll(checked);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Search items by text
    async searchItems(searchText) {
        const allItems = await this.getAllItems();
        const searchLower = searchText.toLowerCase();
        return allItems.filter(item =>
            item.text.toLowerCase().includes(searchLower)
        );
    }

    // Get database statistics
    async getStats() {
        const allItems = await this.getAllItems();
        const checkedItems = allItems.filter(item => item.checked);
        const uncheckedItems = allItems.filter(item => !item.checked);

        return {
            total: allItems.length,
            checked: checkedItems.length,
            unchecked: uncheckedItems.length,
            oldestItem: allItems.length > 0 ?
                allItems.reduce((oldest, item) =>
                    item.timestamp < oldest.timestamp ? item : oldest
                ) : null,
            newestItem: allItems.length > 0 ?
                allItems.reduce((newest, item) =>
                    item.timestamp > newest.timestamp ? item : newest
                ) : null
        };
    }

    // Export database to JSON
    async exportToJSON() {
        const items = await this.getAllItems();
        return JSON.stringify(items, null, 2);
    }

    // Import from JSON
    async importFromJSON(jsonString) {
        try {
            const items = JSON.parse(jsonString);
            await this.clearAll();

            for (const item of items) {
                await this.addItem(item);
            }

            console.log('✅ Imported', items.length, 'items');
            return items.length;
        } catch (error) {
            console.error('❌ Error importing:', error);
            throw error;
        }
    }
}

// Export for use in other files
window.GroceryDatabase = GroceryDatabase;
