const dbServer = require('../dao/dbserver.js'); // 引入数据操作模块

/**
 * 数据指挥功能服务层
 * 提供动态配置的指挥功能入口管理
 */

// 获取指挥配置列表
const getCommandConfig = function (req, res) {
    try {
        // 调用数据层获取配置
        dbServer.getCommandConfig(res);
    } catch (error) {
        console.error('获取指挥配置失败:', error);
        res.send({
            code: 500,
            msg: '获取指挥配置失败',
            data: null
        });
    }
};

// 保存指挥配置
const saveCommandConfig = function (req, res) {
    try {
        const { data } = req.body;
        
        // 验证必填字段
        if (!data.configId || !data.title || !data.desc || !data.url) {
            return res.send({
                code: 400,
                msg: 'configId、标题、描述和URL都是必填项',
                data: null
            });
        }
        // 验证URL格式
        if (data.url) {
            try {
                new URL(data.url);
            } catch (e) {
                return res.send({
                    code: 400,
                    msg: 'URL格式不正确',
                    data: null
                });
            }
        }

        // 调用数据层保存配置
        dbServer.saveCommandConfig(data, res);
    } catch (error) {
        console.error('保存指挥配置失败:', error);
        res.send({
            code: 500,
            msg: '保存指挥配置失败',
            data: null
        });
    }
};

// 更新指挥配置
const updateCommandConfig = function (req, res) {
    try {
        const { data } = req.body;
        
        // 验证必填字段
        if (!data.configId || !data.title || !data.desc || !data.url) {
            return res.send({
                code: 400,
                msg: 'configId、标题、描述和URL都是必填项',
                data: null
            });
        }

        // 验证URL格式
        try {
            new URL(data.url);
        } catch (e) {
            return res.send({
                code: 400,
                msg: 'URL格式不正确',
                data: null
            });
        }

        // 调用数据层更新配置
        dbServer.updateCommandConfig(data, res);
    } catch (error) {
        console.error('更新指挥配置失败:', error);
        res.send({
            code: 500,
            msg: '更新指挥配置失败',
            data: null
        });
    }
};

// 删除指挥配置
const deleteCommandConfig = function (req, res) {
    try {
        console.log('req.body', req.body);
        const { configId } = req.body;
        
        if (!configId) {
            return res.send({
                code: 400,
                msg: '配置ID不能为空',
                data: null
            });
        }

        // 调用数据层删除配置
        dbServer.deleteCommandConfig(configId, res);
    } catch (error) {
        console.error('删除指挥配置失败:', error);
        res.send({
            code: 500,
            msg: '删除指挥配置失败',
            data: null
        });
    }
};
module.exports = {
    getCommandConfig,
    saveCommandConfig,
    updateCommandConfig,
    deleteCommandConfig
};
