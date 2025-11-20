const axios = require('axios');

// DeepSeek API 配置（建议通过环境变量配置）
const DEEPSEEK_CONFIG = {
    apiKey: 'sk-94b4b7e1a8e3435cb3701a5d0dcab80a', // 需要设置 API Key
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat' // DeepSeek 模型名称
};

// AI 对话接口
exports.chat = async (req, res) => {
    try {
        const { message, userId, history = [] } = req.body;

        // 参数验证
        if (!message || !message.trim()) {
            return res.send({
                code: 400,
                msg: '缺少 message 参数',
                data: null
            });
        }

        if (!userId) {
            return res.send({
                code: 400,
                msg: '缺少 userId 参数',
                data: null
            });
        }

        // 检查 API Key
        if (!DEEPSEEK_CONFIG.apiKey) {
            console.error('DeepSeek API Key 未配置');
            return res.send({
                code: 500,
                msg: 'AI 服务未配置，请联系管理员',
                data: null
            });
        }

        // 构建消息历史记录
        const messages = [];
        
        // 如果有历史记录，先添加历史消息
        if (Array.isArray(history) && history.length > 0) {
            // 确保历史记录格式正确
            history.forEach(item => {
                if (item.role && item.content) {
                    messages.push({
                        role: item.role, // user 或 assistant
                        content: item.content
                    });
                }
            });
        }

        // 添加当前用户消息
        messages.push({
            role: 'user',
            content: message
        });

        // 调用 DeepSeek API
        try {
            console.log('开始调用 DeepSeek API...');
            console.log('API URL:', DEEPSEEK_CONFIG.apiUrl);
            console.log('模型:', DEEPSEEK_CONFIG.model);
            console.log('消息数量:', messages.length);
            
            const response = await axios.post(
                DEEPSEEK_CONFIG.apiUrl,
                {
                    model: DEEPSEEK_CONFIG.model,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 2000,
                    stream: false
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`
                    },
                    timeout: 30000 // 30秒超时
                }
            );

            const aiResponse = response.data;
            console.log('DeepSeek API 响应状态:', response.status);
            console.log('DeepSeek API 响应数据:', JSON.stringify(aiResponse, null, 2));

            // 检查 API 响应
            if (!aiResponse || !aiResponse.choices || aiResponse.choices.length === 0) {
                console.error('DeepSeek API 返回异常 - 响应数据:', JSON.stringify(aiResponse, null, 2));
                return res.send({
                    code: 500,
                    msg: 'AI 服务返回异常：响应数据格式不正确',
                    data: null,
                    debug: {
                        response: aiResponse
                    }
                });
            }

            // 提取 AI 回复内容
            const aiMessage = aiResponse.choices[0].message.content;
            const usage = aiResponse.usage || {};

            console.log('AI 回复成功，Token 使用:', usage);

            // 返回成功响应
            return res.send({
                code: 200,
                msg: 'success',
                data: {
                    message: aiMessage,
                    userId: userId,
                    usage: {
                        promptTokens: usage.prompt_tokens || 0,
                        completionTokens: usage.completion_tokens || 0,
                        totalTokens: usage.total_tokens || 0
                    },
                    model: DEEPSEEK_CONFIG.model
                }
            });

        } catch (apiError) {
            // 详细的错误日志
            console.error('========== DeepSeek API 调用失败 ==========');
            console.error('错误类型:', apiError.name);
            console.error('错误消息:', apiError.message);
            
            if (apiError.response) {
                // HTTP 响应错误
                console.error('HTTP 状态码:', apiError.response.status);
                console.error('响应头:', apiError.response.headers);
                console.error('响应数据:', JSON.stringify(apiError.response.data, null, 2));
            } else if (apiError.request) {
                // 请求已发送但没有收到响应
                console.error('请求已发送，但未收到响应');
                console.error('请求配置:', {
                    url: apiError.config?.url,
                    method: apiError.config?.method,
                    headers: apiError.config?.headers
                });
            } else {
                // 请求配置错误
                console.error('请求配置错误:', apiError.config);
            }
            console.error('完整错误对象:', apiError);
            console.error('==========================================');
            
            // 处理不同的错误情况
            let errorMsg = 'AI 服务调用失败';
            let errorCode = 500;
            let errorDetails = null;
            
            if (apiError.response) {
                const status = apiError.response.status;
                const errorData = apiError.response.data;
                errorDetails = errorData;
                
                if (status === 401) {
                    errorMsg = 'API Key 无效或已过期，请检查 API Key 配置';
                    errorCode = 401;
                } else if (status === 402) {
                    errorMsg = '账户余额不足，请充值后使用';
                    errorCode = 402;
                } else if (status === 403) {
                    errorMsg = 'API Key 无权限访问此服务';
                    errorCode = 403;
                } else if (status === 429) {
                    errorMsg = '请求过于频繁，请稍后再试';
                    errorCode = 429;
                } else if (status === 500 || status === 502 || status === 503) {
                    errorMsg = 'DeepSeek 服务暂时不可用，请稍后再试';
                    errorCode = status;
                } else if (errorData?.error?.message) {
                    errorMsg = errorData.error.message;
                } else if (errorData?.message) {
                    errorMsg = errorData.message;
                } else {
                    // 使用状态码对应的默认错误信息
                    errorMsg = `API 调用失败 (状态码: ${status})`;
                }
            } else if (apiError.code === 'ECONNABORTED') {
                errorMsg = '请求超时，请稍后再试';
            } else if (apiError.code === 'ENOTFOUND' || apiError.code === 'ECONNREFUSED') {
                errorMsg = '无法连接到 DeepSeek 服务器，请检查网络连接';
            } else if (apiError.message) {
                errorMsg = apiError.message;
            }

            return res.send({
                code: errorCode,
                msg: errorMsg,
                data: null,
                error: apiError.message,
                debug: {
                    errorType: apiError.name,
                    errorCode: apiError.code,
                    statusCode: apiError.response?.status,
                    errorDetails: errorDetails
                }
            });
        }

    } catch (err) {
        console.error('AI 对话处理失败:', err);
        res.send({
            code: 500,
            msg: '处理失败',
            error: err.message,
            data: null
        });
    }
};

