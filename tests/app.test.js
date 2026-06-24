/**
 * @jest-environment jsdom
 */

const { createApp } = require('../src/app');

function makeStorage(initial) {
  const store = { ...initial };
  return {
    getItem: jest.fn(k => (k in store ? store[k] : null)),
    setItem: jest.fn((k, v) => { store[k] = v; }),
    removeItem: jest.fn(k => { delete store[k]; }),
    _store: store
  };
}

function makeDoc() {
  document.body.innerHTML = '<div id="messagesList"></div>';
  return document;
}

function sampleMessages() {
  return [
    { id: 1, title: 'Script A', content: 'console.log("hi")', category: 'scripts', date: '2025-01-01T00:00:00Z' },
    { id: 2, title: 'Note B', content: 'hello world', category: 'messages', date: '2025-01-02T00:00:00Z' },
    { id: 3, title: 'Collab C', content: 'working together', category: 'working', date: '2025-01-03T00:00:00Z' }
  ];
}

// ──────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────
describe('createApp - initialization', () => {
  test('loads messages from storage', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    expect(app.getMessages()).toHaveLength(3);
  });

  test('defaults to empty array when storage is empty', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    expect(app.getMessages()).toEqual([]);
  });

  test('defaults filter to "all"', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    expect(app.getCurrentFilter()).toBe('all');
  });

  test('defaults currentEditId to null', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    expect(app.getCurrentEditId()).toBeNull();
  });
});

// ──────────────────────────────────────────────
// getCategoryColor
// ──────────────────────────────────────────────
describe('getCategoryColor', () => {
  let app;
  beforeEach(() => {
    app = createApp(makeStorage({}), makeDoc());
  });

  test('returns blue classes for scripts', () => {
    expect(app.getCategoryColor('scripts')).toBe('bg-blue-900 text-blue-300');
  });

  test('returns amber classes for working', () => {
    expect(app.getCategoryColor('working')).toBe('bg-amber-900 text-amber-300');
  });

  test('returns purple classes for messages (default)', () => {
    expect(app.getCategoryColor('messages')).toBe('bg-purple-900 text-purple-300');
  });

  test('returns purple classes for unknown category', () => {
    expect(app.getCategoryColor('unknown')).toBe('bg-purple-900 text-purple-300');
  });
});

// ──────────────────────────────────────────────
// saveToStorage
// ──────────────────────────────────────────────
describe('saveToStorage', () => {
  test('persists messages to localStorage', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.saveToStorage();
    expect(storage.setItem).toHaveBeenCalledWith('frcMessages', JSON.stringify(sampleMessages()));
  });

  test('persists empty array when no messages', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    app.saveToStorage();
    expect(storage.setItem).toHaveBeenCalledWith('frcMessages', '[]');
  });
});

// ──────────────────────────────────────────────
// renderMessages
// ──────────────────────────────────────────────
describe('renderMessages', () => {
  test('shows empty state when no messages', () => {
    const app = createApp(makeStorage({}), makeDoc());
    app.renderMessages([]);
    const container = document.getElementById('messagesList');
    expect(container.innerHTML).toContain('No messages yet');
  });

  test('renders message cards for each message', () => {
    const app = createApp(makeStorage({}), makeDoc());
    app.renderMessages(sampleMessages());
    const container = document.getElementById('messagesList');
    expect(container.children.length).toBe(3);
  });

  test('renders message title in card', () => {
    const app = createApp(makeStorage({}), makeDoc());
    const msgs = [sampleMessages()[0]];
    app.renderMessages(msgs);
    const container = document.getElementById('messagesList');
    expect(container.innerHTML).toContain('Script A');
  });

  test('renders message content in card', () => {
    const app = createApp(makeStorage({}), makeDoc());
    const msgs = [sampleMessages()[1]];
    app.renderMessages(msgs);
    const container = document.getElementById('messagesList');
    expect(container.innerHTML).toContain('hello world');
  });

  test('renders category badge with correct color', () => {
    const app = createApp(makeStorage({}), makeDoc());
    const msgs = [sampleMessages()[0]];
    app.renderMessages(msgs);
    const container = document.getElementById('messagesList');
    expect(container.innerHTML).toContain('bg-blue-900');
  });

  test('clears container before re-rendering', () => {
    const app = createApp(makeStorage({}), makeDoc());
    app.renderMessages(sampleMessages());
    app.renderMessages([sampleMessages()[0]]);
    const container = document.getElementById('messagesList');
    expect(container.children.length).toBe(1);
  });
});

// ──────────────────────────────────────────────
// filterCategory & loadMessages
// ──────────────────────────────────────────────
describe('filterCategory', () => {
  test('sets filter to "scripts" and renders only script messages', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.filterCategory('scripts');
    expect(app.getCurrentFilter()).toBe('scripts');
    const container = document.getElementById('messagesList');
    expect(container.children.length).toBe(1);
    expect(container.innerHTML).toContain('Script A');
  });

  test('sets filter to "all" and renders all messages', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.filterCategory('scripts');
    app.filterCategory('all');
    const container = document.getElementById('messagesList');
    expect(container.children.length).toBe(3);
  });

  test('sets filter to "working" and renders only working messages', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.filterCategory('working');
    const container = document.getElementById('messagesList');
    expect(container.children.length).toBe(1);
    expect(container.innerHTML).toContain('Collab C');
  });

  test('filter with no matching messages renders empty state', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify([sampleMessages()[0]]) });
    const app = createApp(storage, makeDoc());
    app.filterCategory('working');
    const container = document.getElementById('messagesList');
    expect(container.innerHTML).toContain('No messages yet');
  });
});

describe('loadMessages', () => {
  test('renders all messages when filter is "all"', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.loadMessages();
    const container = document.getElementById('messagesList');
    expect(container.children.length).toBe(3);
  });
});

// ──────────────────────────────────────────────
// newMessage
// ──────────────────────────────────────────────
describe('newMessage', () => {
  test('resets currentEditId to null', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.openModal(1);
    expect(app.getCurrentEditId()).toBe(1);
    app.newMessage();
    expect(app.getCurrentEditId()).toBeNull();
  });
});

// ──────────────────────────────────────────────
// openModal
// ──────────────────────────────────────────────
describe('openModal', () => {
  test('returns message data for valid id', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    const msg = app.openModal(2);
    expect(msg.title).toBe('Note B');
    expect(msg.content).toBe('hello world');
  });

  test('sets currentEditId to the opened message id', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.openModal(2);
    expect(app.getCurrentEditId()).toBe(2);
  });

  test('returns null for non-existent id', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    const result = app.openModal(999);
    expect(result).toBeNull();
  });

  test('does not change currentEditId for non-existent id', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.openModal(999);
    expect(app.getCurrentEditId()).toBeNull();
  });
});

// ──────────────────────────────────────────────
// saveModal
// ──────────────────────────────────────────────
describe('saveModal', () => {
  test('creates new message when currentEditId is null', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    app.saveModal('Test Title', 'Test Content', 'scripts');
    expect(app.getMessages()).toHaveLength(1);
    expect(app.getMessages()[0].title).toBe('Test Title');
    expect(app.getMessages()[0].content).toBe('Test Content');
    expect(app.getMessages()[0].category).toBe('scripts');
  });

  test('prepends new message to the list', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.saveModal('New One', 'new content', 'messages');
    expect(app.getMessages()[0].title).toBe('New One');
    expect(app.getMessages()).toHaveLength(4);
  });

  test('uses "Untitled" when title is empty', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    app.saveModal('', 'some content', 'messages');
    expect(app.getMessages()[0].title).toBe('Untitled');
  });

  test('uses "Untitled" when title is whitespace', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    app.saveModal('   ', 'some content', 'messages');
    expect(app.getMessages()[0].title).toBe('Untitled');
  });

  test('updates existing message when currentEditId is set', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.openModal(1);
    app.saveModal('Updated Title', 'Updated Content', 'working');
    const msg = app.getMessages().find(m => m.id === 1);
    expect(msg.title).toBe('Updated Title');
    expect(msg.content).toBe('Updated Content');
    expect(msg.category).toBe('working');
  });

  test('persists to storage after saving', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    app.saveModal('X', 'Y', 'messages');
    expect(storage.setItem).toHaveBeenCalled();
    const saved = JSON.parse(storage._store.frcMessages);
    expect(saved).toHaveLength(1);
  });

  test('new message gets an id based on Date.now()', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    const before = Date.now();
    app.saveModal('T', 'C', 'messages');
    const after = Date.now();
    const id = app.getMessages()[0].id;
    expect(id).toBeGreaterThanOrEqual(before);
    expect(id).toBeLessThanOrEqual(after);
  });

  test('updated message gets a new date', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    const originalDate = app.getMessages().find(m => m.id === 1).date;
    app.openModal(1);
    app.saveModal('Same', 'Same', 'scripts');
    const newDate = app.getMessages().find(m => m.id === 1).date;
    expect(new Date(newDate).getTime()).toBeGreaterThanOrEqual(new Date(originalDate).getTime());
  });
});

// ──────────────────────────────────────────────
// deleteCurrent
// ──────────────────────────────────────────────
describe('deleteCurrent', () => {
  test('removes the currently open message', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.openModal(2);
    const result = app.deleteCurrent();
    expect(result).toBe(true);
    expect(app.getMessages()).toHaveLength(2);
    expect(app.getMessages().find(m => m.id === 2)).toBeUndefined();
  });

  test('returns false when no message is selected', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    const result = app.deleteCurrent();
    expect(result).toBe(false);
    expect(app.getMessages()).toHaveLength(3);
  });

  test('persists to storage after deleting', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.openModal(1);
    app.deleteCurrent();
    const saved = JSON.parse(storage._store.frcMessages);
    expect(saved).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────
// copyMessage
// ──────────────────────────────────────────────
describe('copyMessage', () => {
  test('returns content of message by id', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    expect(app.copyMessage('2')).toBe('hello world');
  });

  test('returns null for non-existent id', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    expect(app.copyMessage('999')).toBeNull();
  });

  test('parses string id to int', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    expect(app.copyMessage('1')).toBe('console.log("hi")');
  });
});

// ──────────────────────────────────────────────
// sendQuickMessage
// ──────────────────────────────────────────────
describe('sendQuickMessage', () => {
  let app;
  beforeEach(() => {
    app = createApp(makeStorage({}), makeDoc());
  });

  test('returns trimmed content for valid input', () => {
    expect(app.sendQuickMessage('  hello  ')).toBe('hello');
  });

  test('returns null for empty string', () => {
    expect(app.sendQuickMessage('')).toBeNull();
  });

  test('returns null for whitespace-only string', () => {
    expect(app.sendQuickMessage('   ')).toBeNull();
  });

  test('returns null for null input', () => {
    expect(app.sendQuickMessage(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(app.sendQuickMessage(undefined)).toBeNull();
  });
});

// ──────────────────────────────────────────────
// saveQuickMessage
// ──────────────────────────────────────────────
describe('saveQuickMessage', () => {
  test('adds a message with category "messages" and title starting with "Quick Save"', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    const result = app.saveQuickMessage('quick note');
    expect(result).toBe(true);
    expect(app.getMessages()).toHaveLength(1);
    expect(app.getMessages()[0].title).toMatch(/^Quick Save/);
    expect(app.getMessages()[0].content).toBe('quick note');
    expect(app.getMessages()[0].category).toBe('messages');
  });

  test('returns false for empty input', () => {
    const app = createApp(makeStorage({}), makeDoc());
    expect(app.saveQuickMessage('')).toBe(false);
  });

  test('returns false for null input', () => {
    const app = createApp(makeStorage({}), makeDoc());
    expect(app.saveQuickMessage(null)).toBe(false);
  });

  test('trims content before saving', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    app.saveQuickMessage('  trimmed  ');
    expect(app.getMessages()[0].content).toBe('trimmed');
  });

  test('persists to storage', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    app.saveQuickMessage('saved');
    expect(storage.setItem).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// exportData
// ──────────────────────────────────────────────
describe('exportData', () => {
  test('returns JSON string of all messages', () => {
    const msgs = sampleMessages();
    const storage = makeStorage({ frcMessages: JSON.stringify(msgs) });
    const app = createApp(storage, makeDoc());
    const exported = app.exportData();
    expect(JSON.parse(exported)).toEqual(msgs);
  });

  test('returns "[]" when no messages exist', () => {
    const app = createApp(makeStorage({}), makeDoc());
    expect(app.exportData()).toBe('[]');
  });

  test('produces pretty-printed JSON', () => {
    const app = createApp(makeStorage({}), makeDoc());
    app.saveModal('X', 'Y', 'messages');
    const exported = app.exportData();
    expect(exported).toContain('\n');
  });
});

// ──────────────────────────────────────────────
// confirmImport
// ──────────────────────────────────────────────
describe('confirmImport', () => {
  test('imports valid JSON array and replaces messages', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    const importData = JSON.stringify(sampleMessages());
    const result = app.confirmImport(importData);
    expect(result.success).toBe(true);
    expect(result.count).toBe(3);
    expect(app.getMessages()).toHaveLength(3);
  });

  test('persists imported messages to storage', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    app.confirmImport(JSON.stringify(sampleMessages()));
    const saved = JSON.parse(storage._store.frcMessages);
    expect(saved).toHaveLength(3);
  });

  test('returns error for invalid JSON', () => {
    const app = createApp(makeStorage({}), makeDoc());
    const result = app.confirmImport('not valid json');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid JSON format.');
  });

  test('returns error for non-array JSON', () => {
    const app = createApp(makeStorage({}), makeDoc());
    const result = app.confirmImport('{"key": "value"}');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not an array');
  });

  test('handles empty array import', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    const result = app.confirmImport('[]');
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(app.getMessages()).toHaveLength(0);
  });

  test('trims whitespace from input before parsing', () => {
    const app = createApp(makeStorage({}), makeDoc());
    const result = app.confirmImport('  []  ');
    expect(result.success).toBe(true);
  });

  test('replaces all existing messages on import', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    const newMsgs = [{ id: 99, title: 'Imported', content: 'new', category: 'scripts', date: '2025-06-01T00:00:00Z' }];
    app.confirmImport(JSON.stringify(newMsgs));
    expect(app.getMessages()).toHaveLength(1);
    expect(app.getMessages()[0].id).toBe(99);
  });
});

// ──────────────────────────────────────────────
// Integration / round-trip tests
// ──────────────────────────────────────────────
describe('integration', () => {
  test('create → edit → delete round-trip', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());

    app.saveModal('First', 'content', 'scripts');
    expect(app.getMessages()).toHaveLength(1);
    const id = app.getMessages()[0].id;

    app.openModal(id);
    app.saveModal('Edited', 'new content', 'working');
    expect(app.getMessages()[0].title).toBe('Edited');
    expect(app.getMessages()[0].category).toBe('working');

    app.openModal(id);
    app.deleteCurrent();
    expect(app.getMessages()).toHaveLength(0);
  });

  test('export → import round-trip preserves data', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());

    app.saveModal('A', 'content A', 'scripts');
    app.saveModal('B', 'content B', 'messages');
    const exported = app.exportData();

    const app2 = createApp(makeStorage({}), makeDoc());
    app2.confirmImport(exported);
    expect(app2.getMessages()).toHaveLength(2);
    expect(app2.getMessages().map(m => m.title).sort()).toEqual(['A', 'B']);
  });

  test('filter persists across load calls', () => {
    const storage = makeStorage({ frcMessages: JSON.stringify(sampleMessages()) });
    const app = createApp(storage, makeDoc());
    app.filterCategory('scripts');
    app.loadMessages();
    const container = document.getElementById('messagesList');
    expect(container.children.length).toBe(1);
  });

  test('quick save then filter to messages shows it', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    app.saveQuickMessage('quick content');
    app.filterCategory('messages');
    const container = document.getElementById('messagesList');
    expect(container.children.length).toBe(1);
    expect(container.innerHTML).toContain('quick content');
  });

  test('multiple creates maintain order (newest first)', () => {
    const storage = makeStorage({});
    const app = createApp(storage, makeDoc());
    app.saveModal('First', 'c1', 'messages');
    app.saveModal('Second', 'c2', 'messages');
    app.saveModal('Third', 'c3', 'messages');
    expect(app.getMessages()[0].title).toBe('Third');
    expect(app.getMessages()[2].title).toBe('First');
  });
});
