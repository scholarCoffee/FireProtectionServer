const locationService = require('../dao/locationService.js');

module.exports = function(app) {
    // 地址列表查询（支持分页和模糊搜索）
    app.get('/api/location/list', locationService.getLocationList);
    
    // 地址明细查询
    app.get('/api/location/detail', locationService.getLocationDetail);
    
    // 新增地址信息
    app.post('/api/location/add', locationService.addLocation);
    
    // 更新地址信息
    app.put('/api/location/:addressId', locationService.updateLocation);
    
    // 删除地址信息
    app.delete('/api/location/:addressId', locationService.deleteLocation);
    
    // 获取地址统计信息
    app.get('/api/location/stats', locationService.getLocationStats);
}; 