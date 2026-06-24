/**
 * FRC App - Core logic module
 * Extracted from index.html for testability.
 */

function createApp(storage, doc) {
  let messages = JSON.parse(storage.getItem('frcMessages')) || [];
  let currentFilter = 'all';
  let currentEditId = null;

  function saveToStorage() {
    storage.setItem('frcMessages', JSON.stringify(messages));
  }

  function getCategoryColor(cat) {
    if (cat === 'scripts') return 'bg-blue-900 text-blue-300';
    if (cat === 'working') return 'bg-amber-900 text-amber-300';
    return 'bg-purple-900 text-purple-300';
  }

  function getMessages() {
    return messages;
  }

  function getCurrentFilter() {
    return currentFilter;
  }

  function getCurrentEditId() {
    return currentEditId;
  }

  function setCurrentEditId(id) {
    currentEditId = id;
  }

  function renderMessages(filtered) {
    const container = doc.getElementById('messagesList');
    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center py-20">No messages yet. Create one!</p>';
      return;
    }

    filtered.forEach(msg => {
      const div = doc.createElement('div');
      div.className = 'bg-gray-800 rounded-2xl p-6 hover:bg-gray-700 transition-all group';
      div.innerHTML = `
        <div class="flex justify-between">
          <div>
            <h4 class="font-semibold text-lg">${msg.title}</h4>
            <p class="text-xs text-gray-500">${new Date(msg.date).toLocaleDateString()}</p>
          </div>
          <span class="text-xs px-4 py-1.5 rounded-full ${getCategoryColor(msg.category)}">${msg.category}</span>
        </div>
        <p class="mt-4 text-gray-300 line-clamp-4 message-content">${msg.content}</p>
      `;
      container.appendChild(div);
    });
  }

  function filterCategory(cat) {
    currentFilter = cat;
    loadMessages();
  }

  function loadMessages() {
    let filtered = messages;
    if (currentFilter !== 'all') {
      filtered = messages.filter(m => m.category === currentFilter);
    }
    renderMessages(filtered);
  }

  function newMessage() {
    currentEditId = null;
  }

  function openModal(id) {
    const msg = messages.find(m => m.id === id);
    if (!msg) return null;
    currentEditId = id;
    return msg;
  }

  function saveModal(title, content, category) {
    const finalTitle = (title && title.trim()) || 'Untitled';

    if (currentEditId) {
      const msg = messages.find(m => m.id === currentEditId);
      if (msg) {
        msg.title = finalTitle;
        msg.content = content;
        msg.category = category;
        msg.date = new Date().toISOString();
      }
    } else {
      messages.unshift({
        id: Date.now(),
        title: finalTitle,
        content,
        category,
        date: new Date().toISOString()
      });
    }

    saveToStorage();
    loadMessages();
  }

  function deleteCurrent() {
    if (!currentEditId) return false;
    messages = messages.filter(m => m.id !== currentEditId);
    saveToStorage();
    loadMessages();
    return true;
  }

  function copyMessage(id) {
    const msg = messages.find(m => m.id === parseInt(id));
    return msg ? msg.content : null;
  }

  function sendQuickMessage(content) {
    if (!content || !content.trim()) return null;
    return content.trim();
  }

  function saveQuickMessage(content) {
    if (!content || !content.trim()) return false;

    messages.unshift({
      id: Date.now(),
      title: 'Quick Save ' + new Date().toLocaleDateString(),
      content: content.trim(),
      category: 'messages',
      date: new Date().toISOString()
    });

    saveToStorage();
    loadMessages();
    return true;
  }

  function exportData() {
    return JSON.stringify(messages, null, 2);
  }

  function confirmImport(jsonString) {
    try {
      const imported = JSON.parse(jsonString.trim());
      if (!Array.isArray(imported)) return { success: false, error: 'Not an array' };
      messages = imported;
      saveToStorage();
      loadMessages();
      return { success: true, count: imported.length };
    } catch (e) {
      return { success: false, error: 'Invalid JSON format.' };
    }
  }

  return {
    getMessages,
    getCurrentFilter,
    getCurrentEditId,
    setCurrentEditId,
    saveToStorage,
    getCategoryColor,
    renderMessages,
    filterCategory,
    loadMessages,
    newMessage,
    openModal,
    saveModal,
    deleteCurrent,
    copyMessage,
    sendQuickMessage,
    saveQuickMessage,
    exportData,
    confirmImport
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createApp };
}
