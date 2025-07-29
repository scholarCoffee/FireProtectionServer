const fs = require('fs');
const path = require('path');

// 读取旧版本数据
const readOldData = () => {
    try {
        const oldDataPath = path.join(__dirname, 'fireSafetyScore.json');
        const oldData = fs.readFileSync(oldDataPath, 'utf8');
        return JSON.parse(oldData);
    } catch (err) {
        console.error('读取旧版本数据失败:', err);
        return [];
    }
};

// 读取新版本配置
const readNewConfig = () => {
    try {
        const configPath = path.join(__dirname, 'scoreConfig.json');
        const config = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(config);
    } catch (err) {
        console.error('读取新版本配置失败:', err);
        return null;
    }
};

// 转换数据格式
const convertDataFormat = (oldData, config) => {
    if (!config) {
        console.error('配置无效，无法转换数据');
        return [];
    }
    
    const convertedData = [];
    
    for (const oldRecord of oldData) {
        const scoreItems = new Map();
        
        // 转换评分项目
        const scoreFields = [
            'naturalWaterSource', 'outdoorHydrant', 'vehicleAccess', 
            'buildingHydrant', 'outdoorHydrantWater', 'controlRoom',
            'fireElevator', 'stairwellType', 'unitConnection', 'emergencyTeam'
        ];
        
        for (const field of scoreFields) {
            if (oldRecord[field] !== undefined) {
                const configItem = config.scoreItems.find(item => item.id === field);
                if (configItem) {
                    const option = configItem.options.find(opt => opt.score === oldRecord[field]);
                    scoreItems.set(field, {
                        score: oldRecord[field],
                        option: option ? option.text : '未知',
                        itemId: field
                    });
                }
            }
        }
        
        // 计算总分和百分比
        let totalScore = 0;
        let maxPossibleScore = 0;
        
        for (const item of config.scoreItems) {
            const maxScore = Math.max(...item.options.map(opt => opt.score));
            maxPossibleScore += maxScore;
        }
        
        for (const [itemId, itemData] of scoreItems.entries()) {
            totalScore += itemData.score || 0;
        }
        
        const scorePercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
        
        // 计算安全等级
        let safetyLevel = '未知';
        let safetyColor = '灰色';
        let safetyCssClass = 'safety-unknown';
        let safetyCssColor = '#999999';
        
        for (const level of config.scoreConfig.safetyLevels) {
            if (scorePercentage >= level.minPercentage) {
                safetyLevel = level.level;
                safetyColor = level.color;
                safetyCssClass = level.cssClass;
                safetyCssColor = level.cssColor;
                break;
            }
        }
        
        // 构建新格式数据
        const newRecord = {
            _id: oldRecord._id,
            safeId: oldRecord.safeId,
            addressId: oldRecord.addressId,
            addressName: oldRecord.addressName,
            scoreItems: Object.fromEntries(scoreItems),
            totalScore,
            maxPossibleScore,
            scorePercentage,
            safetyLevel,
            safetyColor,
            safetyCssClass,
            safetyCssColor,
            configVersion: config.configVersion,
            createTime: oldRecord.createTime,
            updateTime: oldRecord.updateTime
        };
        
        convertedData.push(newRecord);
    }
    
    return convertedData;
};

// 生成导入脚本
const generateImportScript = (convertedData) => {
    const script = `// 自动生成的导入脚本
// 使用方法: 将此脚本内容复制到MongoDB Compass或其他MongoDB客户端中执行

const data = ${JSON.stringify(convertedData, null, 2)};

// 清空现有数据（可选）
// db.fireSafetyScores.deleteMany({});

// 插入新数据
db.fireSafetyScores.insertMany(data);

console.log('数据导入完成，共导入 ' + data.length + ' 条记录');
`;

    return script;
};

// 生成API调用示例
const generateApiExamples = (convertedData) => {
    const examples = [];
    
    for (const record of convertedData.slice(0, 3)) { // 只生成前3个示例
        const example = {
            method: 'POST',
            url: '/fireSafetyScore-v2/add',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                safeId: record.safeId,
                addressId: record.addressId,
                addressName: record.addressName,
                scoreItems: record.scoreItems
            }
        };
        examples.push(example);
    }
    
    return examples;
};

// 主函数
const main = () => {
    console.log('开始数据格式转换...');
    
    // 读取数据
    const oldData = readOldData();
    const config = readNewConfig();
    
    if (oldData.length === 0) {
        console.error('没有找到旧版本数据');
        return;
    }
    
    if (!config) {
        console.error('没有找到新版本配置');
        return;
    }
    
    console.log(`找到 ${oldData.length} 条旧版本数据`);
    
    // 转换数据
    const convertedData = convertDataFormat(oldData, config);
    
    if (convertedData.length === 0) {
        console.error('数据转换失败');
        return;
    }
    
    console.log(`成功转换 ${convertedData.length} 条数据`);
    
    // 保存转换后的数据
    const outputPath = path.join(__dirname, 'fireSafetyScore-converted.json');
    fs.writeFileSync(outputPath, JSON.stringify(convertedData, null, 2));
    console.log(`转换后的数据已保存到: ${outputPath}`);
    
    // 生成导入脚本
    const importScript = generateImportScript(convertedData);
    const scriptPath = path.join(__dirname, 'import-script.js');
    fs.writeFileSync(scriptPath, importScript);
    console.log(`导入脚本已生成: ${scriptPath}`);
    
    // 生成API示例
    const apiExamples = generateApiExamples(convertedData);
    const apiPath = path.join(__dirname, 'api-examples.json');
    fs.writeFileSync(apiPath, JSON.stringify(apiExamples, null, 2));
    console.log(`API调用示例已生成: ${apiPath}`);
    
    // 生成批量导入数据
    const batchData = {
        scores: convertedData.map(record => ({
            safeId: record.safeId,
            addressId: record.addressId,
            addressName: record.addressName,
            scoreItems: record.scoreItems
        }))
    };
    const batchPath = path.join(__dirname, 'batch-import-data.json');
    fs.writeFileSync(batchPath, JSON.stringify(batchData, null, 2));
    console.log(`批量导入数据已生成: ${batchPath}`);
    
    console.log('\n转换完成！');
    console.log('文件说明:');
    console.log('- fireSafetyScore-converted.json: 转换后的完整数据');
    console.log('- import-script.js: MongoDB导入脚本');
    console.log('- api-examples.json: API调用示例');
    console.log('- batch-import-data.json: 批量导入数据');
};

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = {
    readOldData,
    readNewConfig,
    convertDataFormat,
    generateImportScript,
    generateApiExamples
}; 