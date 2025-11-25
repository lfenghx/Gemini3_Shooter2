const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 创建数据库连接
const dbPath = path.resolve(__dirname, 'scores.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到SQLite数据库');
    // 创建scores表
    createTables();
  }
});

// 创建表结构
function createTables() {
  // 首先创建表（如果表不存在）
  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      level INTEGER NOT NULL,
      coins INTEGER NOT NULL,
      time INTEGER NOT NULL DEFAULT 0,
      isCompleted INTEGER DEFAULT 0, -- 0表示未通关，1表示已通关(击败BOSS)
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('创建表失败:', err.message);
    } else {
      console.log('数据库表已创建或已存在');
      
      // 表创建成功后，再尝试添加可能缺失的字段
      db.run(`ALTER TABLE scores ADD COLUMN isCompleted INTEGER DEFAULT 0`, (err) => {
        // 如果错误是因为字段已存在或表不存在，忽略这个错误
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
          console.error('添加字段失败:', err.message);
        }
        console.log('数据库表已准备就绪');
      });
    }
  });

}

// 导出数据库连接
module.exports = db;
