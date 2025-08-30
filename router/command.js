const command = require('../server/command.js'); // 引入数据指挥服务模块

module.exports = function (app) {
    /**
     * 数据指挥功能路由配置
     * 提供动态配置的指挥功能入口管理API
     */

    // 获取指挥配置列表
    app.get('/command/config', function (req, res) {
        command.getCommandConfig(req, res);
    });

    // 保存指挥配置
    app.post('/command/config', function (req, res) {
        command.saveCommandConfig(req, res);
    });

    // 更新指挥配置
    app.put('/command/config', function (req, res) {
        command.updateCommandConfig(req, res);
    });

    // 删除指挥配置
    app.delete('/command/config', function (req, res) {
        command.deleteCommandConfig(req, res);
    });

    // 获取可用的图标列表
    app.get('/command/icons', function (req, res) {
        command.getAvailableIcons(req, res);
    });

    // 批量导入指挥配置
    app.post('/command/batchImport', function (req, res) {
        command.batchImportCommandConfig(req, res);
    });

    // 导出指挥配置
    app.get('/command/export', function (req, res) {
        command.exportCommandConfig(req, res);
    });

    // 兼容性路由 - 支持POST方式获取配置
    app.post('/command/getConfig', function (req, res) {
        command.getCommandConfig(req, res);
    });

    // 兼容性路由 - 支持GET方式保存配置（不推荐，但为了兼容性保留）
    app.get('/command/saveConfig', function (req, res) {
        // 将query参数转换为body格式
        req.body = req.query;
        command.saveCommandConfig(req, res);
    });
};
