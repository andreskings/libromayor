export async function processCSV(csvContent) {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const levelIndex = headers.findIndex(h => h.includes('level'));
    const tempIndex = headers.findIndex(h => h.includes('temp'));
    
    let levelSum = 0, levelCount = 0;
    let tempSum = 0, tempCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        
        if (levelIndex !== -1 && values[levelIndex]) {
            const levelValue = parseFloat(values[levelIndex]);
            if (!isNaN(levelValue)) {
                levelSum += levelValue;
                levelCount++;
            }
        }
        
        if (tempIndex !== -1 && values[tempIndex]) {
            const tempValue = parseFloat(values[tempIndex]);
            if (!isNaN(tempValue)) {
                tempSum += tempValue;
                tempCount++;
            }
        }
    }

    return {
        level: levelCount > 0 ? levelSum / levelCount : 'N/A',
        temperature: tempCount > 0 ? tempSum / tempCount : 'N/A'
    };
}