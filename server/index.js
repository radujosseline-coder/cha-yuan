const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 配置文件上传（内存存储）
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ============================================================
// 1. 健康检查
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// 2. AI 识别接口（调用 DeepSeek Vision API）
// ============================================================
app.post('/api/recognize', upload.single('image'), async (req, res) => {
  try {
    const { apiUrl, model, apiKey, temperature, maxTokens } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: '请提供 API Key' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '请上传图片' });
    }

    // 将图片转为 base64
    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

    // 构建请求体（OpenAI 兼容格式）
    const payload = {
      model: model || 'deepseek-v4-flash-vision-exp',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请识别这张茶树叶片图片，判断是否有病虫害。如果有，请说明病害名称、风险等级（低/中/高）、详细描述和防治建议。如果没有病虫害，请说明叶片健康。以JSON格式返回：{"name": "病害名称", "level": "低/中/高", "description": "描述", "advice": "防治建议"}'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      temperature: parseFloat(temperature) || 0.7,
      max_tokens: parseInt(maxTokens) || 1024,
      stream: false
    };

    // 调用 DeepSeek API
    const response = await axios.post(
      apiUrl || 'https://api.deepseek.com/v1/chat/completions',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 60000 // 60秒超时
      }
    );

    // 解析 AI 返回的内容
    const content = response.data.choices?.[0]?.message?.content || '';
    
    // 尝试从返回内容中提取 JSON
    let result = null;
    try {
      // 寻找 JSON 块
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // 如果没找到 JSON，尝试直接解析整个内容
        result = JSON.parse(content);
      }
    } catch (e) {
      // 如果解析失败，返回原始内容
      result = {
        name: '识别结果',
        level: '未知',
        description: content,
        advice: '请参考以上描述进行判断'
      };
    }

    // 确保 result 包含必要字段
    if (!result.name) result.name = '识别结果';
    if (!result.level) result.level = '中';
    if (!result.description) result.description = content;
    if (!result.advice) result.advice = '建议咨询专业农技人员';

    res.json({
      success: true,
      data: result,
      raw: content,
      model: model || 'deepseek-v4-flash-vision-exp'
    });

  } catch (error) {
    console.error('AI 识别失败:', error.message);
    const status = error.response?.status || 500;
    const msg = error.response?.data?.error?.message || error.message || '识别服务异常';
    res.status(status).json({
      success: false,
      error: msg
    });
  }
});

// ============================================================
// 3. 测试连接（验证 API Key 是否有效）
// ============================================================
app.post('/api/test-connection', async (req, res) => {
  try {
    const { apiUrl, model, apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: '请提供 API Key' });
    }

    // 发送一个简单的测试请求
    const response = await axios.post(
      apiUrl || 'https://api.deepseek.com/v1/chat/completions',
      {
        model: model || 'deepseek-v4-flash-vision-exp',
        messages: [
          { role: 'user', content: '请回复"连接成功"四个字' }
        ],
        max_tokens: 20
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 10000
      }
    );

    res.json({
      success: true,
      message: '连接成功！',
      model: model || 'deepseek-v4-flash-vision-exp'
    });

  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message || '连接失败';
    res.status(error.response?.status || 500).json({
      success: false,
      error: msg
    });
  }
});

// ============================================================
// 4. 托管前端静态页面（http://localhost:3000 直接访问系统）
// ============================================================
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// ============================================================
// 启动服务
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 茶智管 服务已启动: http://localhost:${PORT}`);
  console.log(`🌐 前端页面: http://localhost:${PORT}`);
  console.log(`📡 识别接口: POST http://localhost:${PORT}/api/recognize`);
  console.log(`🔗 测试接口: POST http://localhost:${PORT}/api/test-connection`);
});