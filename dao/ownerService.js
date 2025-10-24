const dbmodel = require('../model/index.js');
const OwnerInfo = dbmodel.OwnerInfo;

// 获取户主列表
exports.getOwnerList = async (req, res) => {
    try {
        const { 
            addressId, 
            building = '', 
            unit = '', 
            floor = '', 
            roomNo = '', 
            status = '',
            page = 1,
            pageSize = 10
        } = req.query;

        // 构建查询条件（addressId 可选）
        const query = {};
        if (addressId) query.addressId = addressId;
        if (building) query.building = { $regex: building, $options: 'i' };
        if (unit) query.unit = { $regex: unit, $options: 'i' };
        if (floor) query.floor = { $regex: floor, $options: 'i' };
        if (roomNo) query.roomNo = { $regex: roomNo, $options: 'i' };
        if (status !== '') query.status = parseInt(status);

        // 分页参数（pageSize 最大 20）
        const limit = Math.min(parseInt(pageSize) || 10, 20);
        const current = Math.max(parseInt(page) || 1, 1);
        const skip = (current - 1) * limit;

        const [list, total] = await Promise.all([
            OwnerInfo.find(query, { __v: 0 })
                .sort({ createTime: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            OwnerInfo.countDocuments(query)
        ]);

        // 处理地址信息关联
        let listWithLocation = list;
        if (addressId) {
            // 如果有 addressId 参数，直接查询对应地址信息
            const Location = dbmodel.Location;
            const locationInfo = await Location.findOne(
                { addressId },
                { _id: 0, __v: 0 }
            ).lean();
            
            listWithLocation = list.map(owner => ({
                ...owner,
                location: locationInfo || null
            }));
        } else {
            // 如果没有 addressId 参数，根据查询结果的 addressId 反查 location 信息
            const Location = dbmodel.Location;
            const addressIds = [...new Set(list.map(owner => owner.addressId))];
            const locations = await Location.find(
                { addressId: { $in: addressIds } },
                { _id: 0, __v: 0 }
            ).lean();
            
            const locationMap = {};
            locations.forEach(loc => {
                locationMap[loc.addressId] = loc;
            });
            
            listWithLocation = list.map(owner => ({
                ...owner,
                location: locationMap[owner.addressId] || null
            }));
        }

        const totalPages = Math.ceil(total / limit);

        res.send({
            code: 200,
            msg: 'success',
            data: {
                list: listWithLocation,
                pagination: {
                    current,
                    pageSize: limit,
                    total,
                    totalPages,
                    hasNext: current < totalPages,
                    hasPrev: current > 1
                }
            }
        });
    } catch (err) {
        console.error('获取户主列表失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
};

// 获取户主详情
exports.getOwnerDetail = async (req, res) => {
    try {
        const { _id, addressId } = req.query;

        if (!_id || !addressId) {
            return res.send({ 
                code: 400, 
                msg: '缺少_id或addressId参数' 
            });
        }

        const detail = await OwnerInfo.findOne(
            { _id, addressId },
            { __v: 0 }
        ).lean();

        if (!detail) {
            return res.send({ 
                code: 404, 
                msg: '未找到该户主信息' 
            });
        }

        // 查询关联的地址信息
        const Location = dbmodel.Location;
        const locationInfo = await Location.findOne(
            { addressId: detail.addressId },
            { _id: 0, __v: 0 }
        ).lean();

        const detailWithLocation = {
            ...detail,
            location: locationInfo || null
        };

        res.send({
            code: 200,
            msg: 'success',
            data: detailWithLocation
        });
    } catch (err) {
        console.error('获取户主详情失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
};

// 创建户主信息
exports.createOwner = async (req, res) => {
    try {
        const ownerData = req.body;

        // 验证必填字段
        const requiredFields = ['addressId', 'roomNo', 'name', 'phone', 'status'];
        for (const field of requiredFields) {
            if (!ownerData[field] && ownerData[field] !== 0) {
                return res.send({ 
                    code: 400, 
                    msg: `缺少必填字段: ${field}` 
                });
            }
        }

        // 验证住户情况为"房间有人"时，房间人数必填
        if (ownerData.status === 1 && (!ownerData.peopleCount || ownerData.peopleCount < 1 || ownerData.peopleCount > 100)) {
            return res.send({ 
                code: 400, 
                msg: '当住户情况为房间有人时，房间人数必填且为1-100之间的整数' 
            });
        }

        // 验证手机号格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(ownerData.phone)) {
            return res.send({ 
                code: 400, 
                msg: '手机号格式不正确' 
            });
        }

        // 验证面积格式（如果提供）
        if (ownerData.area) {
            const areaRegex = /^\d+(?:\.\d{1,2})?$/;
            if (!areaRegex.test(ownerData.area)) {
                return res.send({ 
                    code: 400, 
                    msg: '房间面积格式不正确，支持小数点后两位' 
                });
            }
        }

        const newOwner = new OwnerInfo(ownerData);
        const result = await newOwner.save();

        res.send({ 
            code: 200, 
            msg: 'success', 
            data: { _id: result._id } 
        });
    } catch (err) {
        console.error('创建户主信息失败:', err);
        res.send({ 
            code: 500, 
            msg: '创建失败', 
            error: err.message 
        });
    }
};

// 更新户主信息
exports.updateOwner = async (req, res) => {
    try {
        const updateData = req.body;

        if (!updateData._id) {
            return res.send({ 
                code: 400, 
                msg: '缺少_id参数' 
            });
        }

        // 验证必填字段
        const requiredFields = ['addressId', 'roomNo', 'name', 'phone', 'status'];
        for (const field of requiredFields) {
            if (!updateData[field] && updateData[field] !== 0) {
                return res.send({ 
                    code: 400, 
                    msg: `缺少必填字段: ${field}` 
                });
            }
        }

        // 验证住户情况为"房间有人"时，房间人数必填
        if (updateData.status === 1 && (!updateData.peopleCount || updateData.peopleCount < 1 || updateData.peopleCount > 100)) {
            return res.send({ 
                code: 400, 
                msg: '当住户情况为房间有人时，房间人数必填且为1-100之间的整数' 
            });
        }

        // 验证手机号格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(updateData.phone)) {
            return res.send({ 
                code: 400, 
                msg: '手机号格式不正确' 
            });
        }

        // 验证面积格式（如果提供）
        if (updateData.area) {
            const areaRegex = /^\d+(?:\.\d{1,2})?$/;
            if (!areaRegex.test(updateData.area)) {
                return res.send({ 
                    code: 400, 
                    msg: '房间面积格式不正确，支持小数点后两位' 
                });
            }
        }

        updateData.updateTime = new Date();

        const result = await OwnerInfo.findOneAndUpdate(
            { _id: updateData._id },
            updateData,
            { new: true, runValidators: true }
        );

        if (!result) {
            return res.send({ 
                code: 404, 
                msg: '未找到该户主信息' 
            });
        }

        res.send({ 
            code: 200, 
            msg: 'success', 
            data: { _id: result._id } 
        });
    } catch (err) {
        console.error('更新户主信息失败:', err);
        res.send({ 
            code: 500, 
            msg: '更新失败', 
            error: err.message 
        });
    }
};

// 删除户主信息
exports.deleteOwner = async (req, res) => {
    try {
        const { _id, addressId } = req.body;

        if (!_id || !addressId) {
            return res.send({ 
                code: 400, 
                msg: '缺少_id或addressId参数' 
            });
        }

        const result = await OwnerInfo.findOneAndDelete({ _id, addressId });

        if (!result) {
            return res.send({ 
                code: 404, 
                msg: '未找到该户主信息' 
            });
        }

        res.send({ 
            code: 200, 
            msg: 'success', 
            data: { _id } 
        });
    } catch (err) {
        console.error('删除户主信息失败:', err);
        res.send({ 
            code: 500, 
            msg: '删除失败', 
            error: err.message 
        });
    }
};
