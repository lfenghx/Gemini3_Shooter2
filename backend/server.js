const express = require('express');
const cors = require('cors');
const db = require('./db');
const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// API端点：保存分数
app.post('/api/scores', (req, res) => {
  const { name, score, level, coins } = req.body;
  
  if (!name || typeof score !== 'number') {
    return res.status(400).json({ error: '请提供有效的名字和分数' });
  }
  
  // 限制名字长度
  const sanitizedName = name.trim().substring(0, 20);
  
  const sql = 'INSERT INTO scores (name, score, level, coins) VALUES (?, ?, ?, ?)';
  db.run(sql, [sanitizedName, score, level || 1, coins || 0], function(err) {
    if (err) {
      console.error('保存分数失败:', err.message);
      return res.status(500).json({ error: '保存分数失败' });
    }
    
    res.status(201).json({
      id: this.lastID,
      name: sanitizedName,
      score,
      level,
      coins,
      message: '分数保存成功'
    });
  });
});

// API端点：获取排行榜数据（支持分页）
app.get('/api/scores', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;
  
  // 获取总分页数
  db.get('SELECT COUNT(*) as count FROM scores', (err, countResult) => {
    if (err) {
      console.error('获取记录总数失败:', err.message);
      return res.status(500).json({ error: '获取排行榜数据失败' });
    }
    
    const totalPages = Math.ceil(countResult.count / limit);
    
    // 获取当前页的数据
    const sql = 'SELECT * FROM scores ORDER BY score DESC LIMIT ? OFFSET ?';
    db.all(sql, [limit, offset], (err, rows) => {
      if (err) {
        console.error('获取排行榜数据失败:', err.message);
        return res.status(500).json({ error: '获取排行榜数据失败' });
      }
      
      res.json({
        scores: rows,
        pagination: {
          page,
          limit,
          total: countResult.count,
          totalPages
        }
      });
    });
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
