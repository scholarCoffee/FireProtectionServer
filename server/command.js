const dbServer = require('../dao/dbserver.js'); // 引入数据操作模块

/**
 * 数据指挥功能服务层
 * 提供动态配置的指挥功能入口管理
 */

// 获取指挥配置列表
const getCommandConfig = function (req, res) {
    try {
        // 从请求中获取用户ID，用于权限验证
        const userId = req.query.userId || req.body.userId;
        
        // 为了测试方便，如果没有userId则使用默认值
        if (!userId) {
            userId = 'test-user';
        }

        // 调用数据层获取配置
        dbServer.getCommandConfig(userId, res);
    } catch (error) {
        console.error('获取指挥配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取指挥配置失败',
            data: null
        });
    }
};

// 保存指挥配置
const saveCommandConfig = function (req, res) {
    try {
        const data = req.body;
        
        // 验证必填字段
        if (!data.title || !data.desc || !data.icon || !data.url) {
            return res.status(400).json({
                success: false,
                message: '标题、描述、图标和URL都是必填项',
                data: null
            });
        }

        // 验证URL格式
        try {
            new URL(data.url);
        } catch (e) {
            return res.status(400).json({
                success: false,
                message: 'URL格式不正确',
                data: null
            });
        }

        // 调用数据层保存配置
        dbServer.saveCommandConfig(data, res);
    } catch (error) {
        console.error('保存指挥配置失败:', error);
        res.status(500).json({
            success: false,
            message: '保存指挥配置失败',
            data: null
        });
    }
};

// 更新指挥配置
const updateCommandConfig = function (req, res) {
    try {
        const data = req.body;
        
        // 验证必填字段
        if (!data.id || !data.title || !data.desc || !data.icon || !data.url) {
            return res.status(400).json({
                success: false,
                message: 'ID、标题、描述、图标和URL都是必填项',
                data: null
            });
        }

        // 验证URL格式
        try {
            new URL(data.url);
        } catch (e) {
            return res.status(400).json({
                success: false,
                message: 'URL格式不正确',
                data: null
            });
        }

        // 调用数据层更新配置
        dbServer.updateCommandConfig(data, res);
    } catch (error) {
        console.error('更新指挥配置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新指挥配置失败',
            data: null
        });
    }
};

// 删除指挥配置
const deleteCommandConfig = function (req, res) {
    try {
        const { id, userId } = req.body;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                message: '配置ID不能为空',
                data: null
            });
        }

        // 为了测试方便，如果没有userId则使用默认值
        const finalUserId = userId || 'test-user';

        // 调用数据层删除配置
        dbServer.deleteCommandConfig(id, finalUserId, res);
    } catch (error) {
        console.error('删除指挥配置失败:', error);
        res.status(500).json({
            success: false,
            message: '删除指挥配置失败',
            data: null
        });
    }
};

// 获取可用的图标列表
const getAvailableIcons = function (req, res) {
    try {
        // 返回支持的基础图标列表
        const icons = [
            { name: 'manage', label: '管理图标', url: '/static/icons/data/manage.png' },
            { name: 'chart', label: '图表图标', url: '/static/icons/data/chart.png' },
            { name: 'monitor', label: '监控图标', url: '/static/icons/data/monitor.png' },
            { name: 'report', label: '报告图标', url: '/static/icons/data/report.png' },
            { name: 'analysis', label: '分析图标', url: '/static/icons/data/analysis.png' },
            { name: 'dashboard', label: '仪表盘图标', url: '/static/icons/data/dashboard.png' },
            { name: 'alarm', label: '报警图标', url: '/static/icons/data/alarm.png' },
            { name: 'device', label: '设备图标', url: '/static/icons/data/device.png' },
            { name: 'safe', label: '安全图标', url: '/static/icons/data/safe.png' }
        ];

        res.json({
            success: true,
            message: '获取图标列表成功',
            data: icons
        });
    } catch (error) {
        console.error('获取图标列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取图标列表失败',
            data: null
        });
    }
};

// 批量导入指挥配置
const batchImportCommandConfig = function (req, res) {
    try {
        const { configs, userId } = req.body;
        
        if (!Array.isArray(configs)) {
            return res.status(400).json({
                success: false,
                message: '配置数据格式错误',
                data: null
            });
        }

        // 为了测试方便，如果没有userId则使用默认值
        const finalUserId = userId || 'test-user';

        // 验证每个配置项
        for (let config of configs) {
            if (!config.title || !config.desc || !config.icon || !config.url) {
                return res.status(400).json({
                    success: false,
                    message: '配置项缺少必填字段',
                    data: null
                });
            }
        }

        // 调用数据层批量导入
        dbServer.batchImportCommandConfig(configs, finalUserId, res);
    } catch (error) {
        console.error('批量导入指挥配置失败:', error);
        res.status(500).json({
            success: false,
            message: '批量导入指挥配置失败',
            data: null
        });
    }
};

// 导出指挥配置
const exportCommandConfig = function (req, res) {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: '用户ID不能为空',
                data: null
            });
        }

        // 调用数据层导出配置
        dbServer.exportCommandConfig(userId, res);
    } catch (error) {
        console.error('导出指挥配置失败:', error);
        res.status(500).json({
            success: false,
            message: '导出指挥配置失败',
            data: null
        });
    }
};

module.exports = {
    getCommandConfig,
    saveCommandConfig,
    updateCommandConfig,
    deleteCommandConfig,
    getAvailableIcons,
    batchImportCommandConfig,
    exportCommandConfig
};
