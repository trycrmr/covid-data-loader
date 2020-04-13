const fs = require('fs')
const createJHUGlobalTree = require('./createJHUGlobalTree')

;(async() => {

    const last7Days = await createJHUGlobalTree.create(7)
    const last28Days = await createJHUGlobalTree.create(28)
    const allDataToDate = await createJHUGlobalTree.create()

    fs.writeFileSync(`${__dirname}/dev/jhu-data-7-days.json`, JSON.stringify(last7Days));
    fs.writeFileSync(`${__dirname}/dev/jhu-data-28-days.json`, JSON.stringify(last28Days));
    fs.writeFileSync(`${__dirname}/dev/jhu-data-to-date.json`, JSON.stringify(allDataToDate));

})()
