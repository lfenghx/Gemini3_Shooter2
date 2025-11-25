// 加载环境变量
require('dotenv').config();

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
  const { name, score, level, coins, time, isCompleted = false } = req.body;
  
  if (!name || typeof score !== 'number') {
    return res.status(400).json({ error: '请提供有效的名字和分数' });
  }
  
  // 限制名字长度
  const sanitizedName = name.trim().substring(0, 20);
  
  // 第六关且分数高可能表示通关，这里临时设置isCompleted为true
  // 实际应该从前端接收是否真正通关的标志
  const actualCompleted = isCompleted || (level === 6 && score > 1000);
  
  const sql = 'INSERT INTO scores (name, score, level, coins, time, isCompleted) VALUES (?, ?, ?, ?, ?, ?)';
  db.run(sql, [sanitizedName, score, level || 1, coins || 0, time || 0, actualCompleted ? 1 : 0], function(err) {
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
      time,
      message: '分数保存成功'
    });
  });
});

// API端点：获取排行榜数据（支持分页和类型）
app.get('/api/scores', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5; // 与前端保持一致，默认每页5条
  const offset = (page - 1) * limit;
  const type = req.query.type || 'score'; // 默认是积分榜
  
  // 获取查询条件
  let whereClause = ' WHERE score > 0'; // 过滤0分记录
  if (type === 'time') {
    whereClause += ' AND level >= 6 AND isCompleted = 1'; // 竞速榜只显示真正通关(击败BOSS)的玩家
  }
  
  // 获取符合条件的记录总数
  const countQuery = `SELECT COUNT(*) as count FROM scores${whereClause}`;
  
  db.get(countQuery, (err, countResult) => {
    if (err) {
      console.error('获取记录总数失败:', err.message);
      return res.status(500).json({ error: '获取排行榜数据失败' });
    }
    
    const totalItems = countResult.count;
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 1;
    
    // 根据类型选择排序方式
    let sql;
    if (type === 'time') {
      // 竞速榜：按时间升序排序，时间越短排名越靠前
      sql = `SELECT * FROM scores${whereClause} ORDER BY time ASC LIMIT ? OFFSET ?`;
    } else {
      // 积分榜：按分数降序排序
      sql = `SELECT * FROM scores${whereClause} ORDER BY score DESC LIMIT ? OFFSET ?`;
    }
    
    // 获取当前页的数据
    db.all(sql, [limit, offset], (err, rows) => {
      if (err) {
        console.error('获取排行榜数据失败:', err.message);
        return res.status(500).json({ error: '获取排行榜数据失败' });
      }
      
      // 格式化日期，包含时分秒
      const formattedRows = rows.map(row => ({
        ...row,
        date: new Date(row.createdAt).toLocaleString('zh-CN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        })
      }));
      
      res.json({
        scores: formattedRows,
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
