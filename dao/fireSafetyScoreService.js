const dbmodel = require('../model/index.js');
const FireSafetyScore = dbmodel.FireSafetyScore;
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
        level: '未知', 
        color: '灰色', 
        cssClass: 'safety-unknown', 
        cssColor: '#999999' 
    };

    const { safetyLevels } = config.scoreConfig;
    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    
    for (const level of safetyLevels) {
        if (percentage >= level.minPercentage) {
            return { 
                level: level.level, 
                color: level.color,
                cssClass: level.cssClass,
                cssColor: level.cssColor
            };
        }
    }
    return { 
        level: '未知', 
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
    for (const [itemId, itemData] of scoreItems.entries()) {
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
    const configItems = new Map(config.scoreItems.map(item => [item.id, item]));
    
    // 检查是否包含所有必需的评分项
    for (const item of config.scoreItems) {
        if (!scoreItems.has(item.id)) {
            errors.push(`缺少评分项: ${item.name}`);
            continue;
        }
        
        const itemData = scoreItems.get(item.id);
        const configItem = configItems.get(item.id);
        
        // 验证选项是否有效
        const validOptions = configItem.options.map(opt => opt.text);
        if (!validOptions.includes(itemData.option)) {
            errors.push(`评分项"${item.name}"的选项无效: ${itemData.option}`);
        }
        
        // 验证分数是否有效
        const validScores = configItem.options.map(opt => opt.score);
        if (!validScores.includes(itemData.score)) {
            errors.push(`评分项"${item.name}"的分数无效: ${itemData.score}`);
        }
    }
    
    return { valid: errors.length === 0, errors };
};

// 获取消防安全评分列表
exports.getFireSafetyScoreList = async (req, res) => {
    console.log('消防安全评分列表查询:', req.query);
    try {
        const { 
            page = 1, 
            pageSize = 10, 
            keyword = '', 
            safetyLevel = '',
            safetyColor = '',
            category = ''
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
        if (safetyLevel && safetyLevel !== '') {
            query.safetyLevel = safetyLevel;
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
        const scoreData = req.body;
        const config = getScoreConfig();
        
        if (!config) {
            return res.send({ 
                code: 500, 
                msg: '评分配置无效' 
            });
        }
        
        // 检查safeId是否已存在
        const existingScore = await FireSafetyScore.findOne({ 
            safeId: scoreData.safeId 
        });
        
        if (existingScore) {
            return res.send({ 
                code: 400, 
                msg: '该safeId的消防安全评分已存在' 
            });
        }

        // 验证评分数据
        const validation = validateScoreData(scoreData.scoreItems, config);
        if (!validation.valid) {
            return res.send({ 
                code: 400, 
                msg: '评分数据验证失败', 
                errors: validation.errors 
            });
        }

        // 计算总分
        const { totalScore, maxPossibleScore, scorePercentage } = calculateTotalScore(scoreData.scoreItems, config);
        
        // 计算安全等级和颜色
        const { level, color, cssClass, cssColor } = calculateSafetyLevel(totalScore, maxPossibleScore);
        
        // 构建完整数据
        const newScoreData = {
            ...scoreData,
            totalScore,
            maxPossibleScore,
            scorePercentage,
            safetyLevel: level,
            safetyColor: color,
            safetyCssClass: cssClass,
            safetyCssColor: cssColor,
            configVersion: config.configVersion,
            createTime: new Date(),
            updateTime: new Date()
        };

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

// 更新消防安全评分
exports.updateFireSafetyScore = async (req, res) => {
    try {
        const { safeId } = req.params;
        const updateData = req.body;
        const config = getScoreConfig();
        
        if (!config) {
            return res.send({ 
                code: 500, 
                msg: '评分配置无效' 
            });
        }
        
        // 移除safeId字段，避免修改主键
        delete updateData.safeId;
        
        // 验证评分数据
        if (updateData.scoreItems) {
            const validation = validateScoreData(updateData.scoreItems, config);
            if (!validation.valid) {
                return res.send({ 
                    code: 400, 
                    msg: '评分数据验证失败', 
                    errors: validation.errors 
                });
            }
            
            // 重新计算总分
            const { totalScore, maxPossibleScore, scorePercentage } = calculateTotalScore(updateData.scoreItems, config);
            
            // 重新计算安全等级和颜色
            const { level, color, cssClass, cssColor } = calculateSafetyLevel(totalScore, maxPossibleScore);
            
            // 更新数据
            updateData.totalScore = totalScore;
            updateData.maxPossibleScore = maxPossibleScore;
            updateData.scorePercentage = scorePercentage;
            updateData.safetyLevel = level;
            updateData.safetyColor = color;
            updateData.safetyCssClass = cssClass;
            updateData.safetyCssColor = cssColor;
            updateData.configVersion = config.configVersion;
        }
        
        updateData.updateTime = new Date();

        const result = await FireSafetyScore.findOneAndUpdate(
            { safeId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!result) {
            return res.send({ 
                code: 404, 
                msg: '未找到该消防安全评分信息' 
            });
        }

        res.send({
            code: 200,
            msg: '更新成功',
            data: result
        });
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
                { $group: { _id: '$safetyLevel', count: { $sum: 1 } } }
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

// 批量导入评分数据
exports.batchImportScores = async (req, res) => {
    try {
        const { scores } = req.body;
        const config = getScoreConfig();
        
        if (!config) {
            return res.send({ 
                code: 500, 
                msg: '评分配置无效' 
            });
        }
        
        if (!Array.isArray(scores) || scores.length === 0) {
            return res.send({ 
                code: 400, 
                msg: '评分数据格式错误' 
            });
        }
        
        const results = [];
        const errors = [];
        
        for (let i = 0; i < scores.length; i++) {
            const scoreData = scores[i];
            
            try {
                // 检查safeId是否已存在
                const existingScore = await FireSafetyScore.findOne({ 
                    safeId: scoreData.safeId 
                });
                
                if (existingScore) {
                    errors.push(`第${i + 1}条数据: safeId ${scoreData.safeId} 已存在`);
                    continue;
                }
                
                // 验证评分数据
                const validation = validateScoreData(scoreData.scoreItems, config);
                if (!validation.valid) {
                    errors.push(`第${i + 1}条数据: ${validation.errors.join(', ')}`);
                    continue;
                }
                
                // 计算总分
                const { totalScore, maxPossibleScore, scorePercentage } = calculateTotalScore(scoreData.scoreItems, config);
                
                // 计算安全等级和颜色
                const { level, color, cssClass, cssColor } = calculateSafetyLevel(totalScore, maxPossibleScore);
                
                // 构建完整数据
                const newScoreData = {
                    ...scoreData,
                    totalScore,
                    maxPossibleScore,
                    scorePercentage,
                    safetyLevel: level,
                    safetyColor: color,
                    safetyCssClass: cssClass,
                    safetyCssColor: cssColor,
                    configVersion: config.configVersion,
                    createTime: new Date(),
                    updateTime: new Date()
                };
                
                const newScore = new FireSafetyScore(newScoreData);
                const result = await newScore.save();
                results.push(result);
                
            } catch (err) {
                errors.push(`第${i + 1}条数据: ${err.message}`);
            }
        }
        
        res.send({
            code: 200,
            msg: '批量导入完成',
            data: {
                success: results.length,
                failed: errors.length,
                results,
                errors
            }
        });
    } catch (err) {
        console.error('批量导入评分数据失败:', err);
        res.send({ 
            code: 500, 
            msg: '批量导入失败', 
            error: err.message 
        });
    }
}; 