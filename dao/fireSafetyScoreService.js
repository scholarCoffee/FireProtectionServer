const dbmodel = require('../model/index.js');
const FireSafetyScore = dbmodel.FireSafetyScore;
const Location = dbmodel.Location;
const fs = require('fs');
const path = require('path');

// 读取评分配置
const getScoreConfig = () => {
    try {
        const configPath = path.join(__dirname, '../data/fireSafetyScore/scoreConfig.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (err) {
        console.error('读取评分配置失败:', err);
        return null;
    }
};

// 计算安全等级和颜色
const calculateSafetyLevel = (totalScore, maxPossibleScore) => {
    const config = getScoreConfig();
    if (!config) return { 
        levelId: 2, 
        levelName: '一般', 
        color: '灰色', 
        cssClass: 'safety-unknown', 
        cssColor: '#999999' 
    };

    const { safetyLevels } = config.scoreConfig;
    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    
    for (const level of safetyLevels) {
        if (percentage >= level.minPercentage) {
            return { 
                levelId: level.levelId || 2, 
                levelName: level.level, 
                color: level.color,
                cssClass: level.cssClass,
                cssColor: level.cssColor
            };
        }
    }
    return { 
        levelId: 2, 
        levelName: '一般', 
        color: '灰色', 
        cssClass: 'safety-unknown', 
        cssColor: '#999999' 
    };
};

// 计算总分和最高可能分数
const calculateTotalScore = (scoreItems, config) => {
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    if (!config || !config.scoreItems) {
        return { totalScore: 0, maxPossibleScore: 0, scorePercentage: 0 };
    }
    
    // 计算实际得分
    for (const [itemId, itemData] of Object.entries(scoreItems)) {
        totalScore += itemData.score || 0;
    }
    
    // 计算最高可能分数
    for (const item of config.scoreItems) {
        const maxScore = Math.max(...item.options.map(opt => opt.score));
        maxPossibleScore += maxScore;
    }
    
    const scorePercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    
    return { totalScore, maxPossibleScore, scorePercentage };
};

// 验证评分数据
const validateScoreData = (scoreItems, config) => {
    if (!config || !config.scoreItems) {
        return { valid: false, errors: ['评分配置无效'] };
    }
    const errors = [];
    // 检查是否包含所有必需的评分项
    for (const item of config.scoreItems) {
        if (!scoreItems[item.id]) {
            errors.push(`缺少评分项: ${item.name}`);
            continue;
        }
    }
    
    return { valid: errors.length === 0, errors };
};

// 根据addressId获取地址信息
const getLocationByAddressId = async (addressId) => {
    try {
        const location = await Location.findOne({ addressId }).lean();
        return location;
    } catch (err) {
        console.error('获取地址信息失败:', err);
        return null;
    }
};

// 将plain object转换为Map格式
const convertScoreItemsToMap = (scoreItems) => {
    if (!scoreItems || typeof scoreItems !== 'object') {
        return new Map();
    }
    
    const scoreMap = new Map();
    for (const [key, value] of Object.entries(scoreItems)) {
        scoreMap.set(key, value);
    }
    return scoreMap;
};

// 获取消防安全评分列表
exports.getFireSafetyScoreList = async (req, res) => {
    console.log('消防安全评分列表查询:', req.query);
    try {
        const { 
            page = 1, 
            pageSize = 10, 
            keyword = '', 
            safetyLevelName = '',
            safetyColor = ''
        } = req.query;

        // 构建查询条件
        let query = {};
        
        // 关键词模糊搜索
        if (keyword) {
            query.$or = [
                { addressName: { $regex: keyword, $options: 'i' } },
                { safeId: { $regex: keyword, $options: 'i' } }
            ];
        }
        
        // 安全等级筛选
        if (safetyLevelName && safetyLevelName !== '') {
            query.safetyLevelName = safetyLevelName;
        }
        
        // 安全颜色筛选
        if (safetyColor && safetyColor !== '') {
            query.safetyColor = safetyColor;
        }

        // 计算分页参数
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        // 执行查询
        const [list, total] = await Promise.all([
            FireSafetyScore.find(query, { _id: 0, __v: 0 })
                .sort({ createTime: -1 })
                .skip(skip)
                .limit(limit),
            FireSafetyScore.countDocuments(query)
        ]);

        // 计算分页信息
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                list,
                pagination: {
                    current: parseInt(page),
                    pageSize: limit,
                    total,
                    totalPages,
                    hasNext,
                    hasPrev
                }
            }
        });
    } catch (err) {
        console.error('消防安全评分列表查询失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
};

// 获取消防安全评分详情
exports.getFireSafetyScoreDetail = async (req, res) => {
    try {
        const { safeId } = req.query;
        if (!safeId) {
            return res.send({ 
                code: 400, 
                msg: '缺少safeId参数' 
            });
        }

        const detail = await FireSafetyScore.findOne(
            { safeId }, 
            { _id: 0, __v: 0 }
        );

        if (!detail) {
            return res.send({ 
                code: 404, 
                msg: '未找到该消防安全评分信息' 
            });
        }

        // 获取评分配置
        const config = getScoreConfig();
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                detail,
                config
            }
        });
    } catch (err) {
        console.error('消防安全评分详情查询失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
};

// 根据safeId查询消防安全评分信息
exports.getFireSafetyScoreByAddressId = async (addressId) => {
    try {
        return await FireSafetyScore.findOne({ addressId: addressId }).lean();
    } catch (err) {
        console.error('根据safeId查询消防安全评分失败:', err);
        throw err;
    }
};

// 新增消防安全评分
exports.addFireSafetyScore = async (req, res) => {
    try {
        const { safeId, scoreItems, addressId } = req.body;
        const config = getScoreConfig();
        
        if (!config) {
            return res.send({ 
                code: 500, 
                msg: '评分配置无效' 
            });
        }
        
        // 检查safeId是否已存在
        const existingScore = await FireSafetyScore.findOne({ 
            safeId: safeId 
        });
        
        if (existingScore) {
            return res.send({ 
                code: 400, 
                msg: '该safeId的消防安全评分已存在' 
            });
        }

        // 验证评分数据
        const validation = validateScoreData(scoreItems, config);
        if (!validation.valid) {
            return res.send({ 
                code: 400, 
                msg: '评分数据验证失败', 
                errors: validation.errors 
            });
        }

        // 计算总分
        const { totalScore, maxPossibleScore, scorePercentage } = calculateTotalScore(scoreItems, config);
        
        // 计算安全等级和颜色
        const { levelId, levelName, color, cssClass, cssColor } = calculateSafetyLevel(totalScore, maxPossibleScore);
        
        // 构建完整数据
        const newScoreData = {
            safeId,
            scoreItems: convertScoreItemsToMap(scoreItems),
            totalScore,
            maxPossibleScore,
            scorePercentage,
            safetyLevelId: levelId,
            safetyLevelName: levelName,
            safetyColor: color,
            safetyCssClass: cssClass,
            safetyCssColor: cssColor,
            configVersion: config.configVersion,
            createTime: new Date(),
            updateTime: new Date()
        };

        // 如果提供了addressId，添加地址相关信息
        if (addressId) {
            newScoreData.addressId = addressId;
            // 获取地址名称
            const location = await getLocationByAddressId(addressId);
            newScoreData.addressName = location ? location.addressName : '';
        }

        const newScore = new FireSafetyScore(newScoreData);
        const result = await newScore.save();

        res.send({
            code: 200,
            msg: '添加成功',
            data: result
        });
    } catch (err) {
        console.error('添加消防安全评分失败:', err);
        res.send({ 
            code: 500, 
            msg: '添加失败', 
            error: err.message 
        });
    }
};

// 更新消防安全评分（支持upsert）
exports.updateFireSafetyScore = async (req, res) => {
    try {
        const { safeId, scoreItems, addressId } = req.body;
        const config = getScoreConfig();
        
        if (!config) {
            return res.send({ 
                code: 500, 
                msg: '评分配置无效' 
            });
        }

        // 构建更新数据对象
        const updateData = {};
        
        // 验证评分数据
        if (scoreItems) {
            const validation = validateScoreData(scoreItems, config);
            if (!validation.valid) {
                return res.send({ 
                    code: 400, 
                    msg: '评分数据验证失败', 
                    errors: validation.errors 
                });
            }

            // 重新计算总分
            const { totalScore, maxPossibleScore, scorePercentage } = calculateTotalScore(scoreItems, config);
            
            // 重新计算安全等级和颜色
            const { levelId, levelName, color, cssClass, cssColor } = calculateSafetyLevel(totalScore, maxPossibleScore);
            
            // 更新数据
            updateData.scoreItems = convertScoreItemsToMap(scoreItems);
            updateData.totalScore = totalScore;
            updateData.maxPossibleScore = maxPossibleScore;
            updateData.scorePercentage = scorePercentage;
            updateData.safetyLevelId = levelId;
            updateData.safetyLevelName = levelName;
            updateData.safetyColor = color;
            updateData.safetyCssClass = cssClass;
            updateData.safetyCssColor = cssColor;
            updateData.configVersion = config.configVersion;
        }

        updateData.updateTime = new Date();

        // 如果提供了addressId，添加到更新数据中
        if (addressId) {
            updateData.addressId = addressId;
        }

        // 尝试更新现有记录
        let result = await FireSafetyScore.findOneAndUpdate(
            { safeId },
            updateData,
            { new: true, runValidators: true }
        );

        // 如果记录不存在，创建新记录
        if (!result) {
            console.log(`未找到safeId为${safeId}的记录，创建新记录`);
            
            // 构建新记录数据
            const newScoreData = {
                safeId,
                ...updateData,
                createTime: new Date()
            };

            // 如果提供了addressId，添加地址相关信息
            if (addressId) {
                newScoreData.addressId = addressId;
                // 获取地址名称
                const location = await getLocationByAddressId(addressId);
                newScoreData.addressName = location ? location.addressName : '';
            }

            const newScore = new FireSafetyScore(newScoreData);
            result = await newScore.save();
            
            res.send({
                code: 200,
                msg: '记录不存在，已创建新记录',
                data: result
            });
        } else {
            res.send({
                code: 200,
                msg: '更新成功',
                data: result
            });
        }
    } catch (err) {
        console.error('更新消防安全评分失败:', err);
        res.send({ 
            code: 500, 
            msg: '更新失败', 
            error: err.message 
        });
    }
};

// 删除消防安全评分
exports.deleteFireSafetyScore = async (req, res) => {
    try {
        const { safeId } = req.params;

        const result = await FireSafetyScore.findOneAndDelete({ safeId });

        if (!result) {
            return res.send({ 
                code: 404, 
                msg: '未找到该消防安全评分信息' 
            });
        }

        res.send({
            code: 200,
            msg: '删除成功'
        });
    } catch (err) {
        console.error('删除消防安全评分失败:', err);
        res.send({ 
            code: 500, 
            msg: '删除失败', 
            error: err.message 
        });
    }
};

// 获取消防安全评分统计信息
exports.getFireSafetyScoreStats = async (req, res) => {
    try {
        const [totalCount, levelStats, colorStats, avgScore, avgPercentage] = await Promise.all([
            FireSafetyScore.countDocuments(),
            FireSafetyScore.aggregate([
                { $group: { _id: '$safetyLevelName', count: { $sum: 1 } } }
            ]),
            FireSafetyScore.aggregate([
                { $group: { _id: '$safetyColor', count: { $sum: 1 } } }
            ]),
            FireSafetyScore.aggregate([
                { $group: { _id: null, avgScore: { $avg: '$totalScore' } } }
            ]),
            FireSafetyScore.aggregate([
                { $group: { _id: null, avgPercentage: { $avg: '$scorePercentage' } } }
            ])
        ]);

        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                totalCount,
                levelStats,
                colorStats,
                avgScore: avgScore[0]?.avgScore || 0,
                avgPercentage: avgPercentage[0]?.avgPercentage || 0
            }
        });
    } catch (err) {
        console.error('获取统计信息失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
};

// 获取评分配置
exports.getScoreConfig = async (req, res) => {
    try {
        const config = getScoreConfig();
        
        if (!config) {
            return res.send({ 
                code: 404, 
                msg: '未找到评分配置' 
            });
        }

        res.send({
            code: 200,
            msg: '查询成功',
            data: config
        });
    } catch (err) {
        console.error('获取评分配置失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
};

// 内部方法：根据addressId创建默认消防安全评分记录
exports.createDefaultFireSafetyScore = async (addressId, addressName, safeId) => {
    try {
        const config = getScoreConfig();
        
        if (!config) {
            throw new Error('评分配置无效');
        }

        // 检查addressId是否已存在消防安全评分
        const existingScore = await FireSafetyScore.findOne({ 
            addressId: addressId 
        });
        
        if (existingScore) {
            return existingScore; // 如果已存在，直接返回
        }

        // 创建默认的评分项目（选择每项最低得分的选项）
        const defaultScoreItems = {};
        for (const item of config.scoreItems) {
            if (!item || !Array.isArray(item.options) || item.options.length === 0) {
                continue;
            }
            // 选择最低分的选项
            const minOption = item.options.reduce((min, cur) => (cur.score < min.score ? cur : min));
            defaultScoreItems[item.id] = {
                score: minOption.score || 0,
                option: minOption.text || '',
                itemId: item.id,
                remark: '' // 默认备注为空
            };
        }

        // 计算总分
        const { totalScore, maxPossibleScore, scorePercentage } = calculateTotalScore(defaultScoreItems, config);
        
        // 计算安全等级和颜色
        const { levelId, levelName, color, cssClass, cssColor } = calculateSafetyLevel(totalScore, maxPossibleScore);
        
        // 构建完整数据
        const newScoreData = {
            safeId,
            addressId,
            addressName,
            scoreItems: convertScoreItemsToMap(defaultScoreItems),
            totalScore,
            maxPossibleScore,
            scorePercentage,
            safetyLevelId: levelId,
            safetyLevelName: levelName,
            safetyColor: color,
            safetyCssClass: cssClass,
            safetyCssColor: cssColor,
            configVersion: config.configVersion,
            createTime: new Date(),
            updateTime: new Date()
        };

        const newScore = new FireSafetyScore(newScoreData);
        const result = await newScore.save();
        return result;
    } catch (err) {
        console.error('创建默认消防安全评分失败:', err);
        throw err;
    }
};

// 根据addressId添加消防安全评分
exports.addFireSafetyScoreByAddressId = async (req, res) => {
    try {
        const { addressId, scoreItems } = req.body;
        const config = getScoreConfig();
        
        if (!addressId) {
            return res.send({ 
                code: 400, 
                msg: '缺少addressId参数' 
            });
        }
        
        if (!config) {
            return res.send({ 
                code: 500, 
                msg: '评分配置无效' 
            });
        }

        // 检查addressId是否已存在消防安全评分
        const existingScore = await FireSafetyScore.findOne({ 
            addressId: addressId 
        });
        
        if (existingScore) {
            return res.send({ 
                code: 400, 
                msg: '该地址的消防安全评分已存在' 
            });
        }

        // 获取地址信息
        const location = await getLocationByAddressId(addressId);
        if (!location) {
            return res.send({ 
                code: 404, 
                msg: '未找到对应的地址信息' 
            });
        }

        // 生成新的safeId（如果未传入）
        let { safeId } = req.body || {};
        if (!safeId) {
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substr(2, 5);
            safeId = `SAFE${timestamp}${randomSuffix}`;
        }

        // 验证评分数据
        const validation = validateScoreData(scoreItems, config);
        if (!validation.valid) {
            return res.send({ 
                code: 400, 
                msg: '评分数据验证失败', 
                    errors: validation.errors 
            });
        }

        // 计算总分
        const { totalScore, maxPossibleScore, scorePercentage } = calculateTotalScore(scoreItems, config);
        
        // 计算安全等级和颜色
        const { levelId, levelName, color, cssClass, cssColor } = calculateSafetyLevel(totalScore, maxPossibleScore);
        
        // 构建完整数据
        const newScoreData = {
            safeId,
            addressId,
            addressName: location.addressName,
            scoreItems: convertScoreItemsToMap(scoreItems),
            totalScore,
            maxPossibleScore,
            scorePercentage,
            safetyLevelId: levelId,
            safetyLevelName: levelName,
            safetyColor: color,
            safetyCssClass: cssClass,
            safetyCssColor: cssColor,
            configVersion: config.configVersion,
            createTime: new Date(),
            updateTime: new Date()
        };

        const newScore = new FireSafetyScore(newScoreData);
        const result = await newScore.save();

        // 回写Location.safeId（如未设置）
        if (!location.safeId) {
            await Location.findOneAndUpdate(
                { addressId },
                { safeId, updateTime: new Date() },
                { new: true }
            );
        }

        res.send({
            code: 200,
            msg: '添加成功',
            data: result
        });
    } catch (err) {
        console.error('根据addressId添加消防安全评分失败:', err);
        res.send({ 
            code: 500, 
            msg: '添加失败', 
            error: err.message 
        });
    }
};

// 根据addressId删除消防安全评分记录
exports.deleteFireSafetyScoreByAddressId = async (addressId) => {
    try {
        const result = await FireSafetyScore.findOneAndDelete({ addressId });
        if (result) {
            console.log(`成功删除地址 ${addressId} 的消防安全评分记录`);
        } else {
            console.log(`地址 ${addressId} 没有找到消防安全评分记录`);
        }
        return result;
    } catch (err) {
        console.error(`删除地址 ${addressId} 的消防安全评分记录失败:`, err);
        throw err;
    }
}; 