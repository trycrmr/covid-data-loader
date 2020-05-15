const globals = require('./globals');
// const jhucsseScraper = require("./jhucsse")
const jhucsseScraper = require("./jhucsseTest")


exports.create = async (limit = null) => {
  try {

    // Utility functions
    const limiter = (obj, limit) => {
      if(!limit) return obj
      return Object.entries(sortObj(obj))
      .reduce((acc, curr, currIdx, origArr) => { // I added this reduce bit
        if(Object.keys(acc).length < limit) {
          let [key, value] = curr
          acc[key] = value
          return acc
        } else {
          return acc
        }
      }, {})
    }

    const sortObj = obj => {
      return Object.entries(obj).sort((a, b) => b[0].localeCompare(a[0])) // Honestly, not really sure how this returns an object and works, but it does, and it's straight from the docs ¯\_(ツ)_/¯ https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
      .reduce((acc, curr, currIdx, origArr) => { // I added this reduce bit
        let [key, value] = curr
        acc[key] = value
        return acc
      }, {})
    }

    const removeNonDateKeys = obj => {
      let newObj = {}
      for (let [key, value] of Object.entries(obj)) {
        if(Number.isInteger(Number.parseInt(key[0]))) newObj[key] = value // Suuure because if the first character can be parsed as a number it's a key that's a date. I know, don't @ me, this filtering could be more precise.
      }
      return newObj
    }

    const convertAllKeysThatAreDatesToUnixTimestamps = (obj) => { // Lol long name.
      return Object.entries(obj).reduce((acc, curr, currIdx, origArr) => {
        let [key, value] = curr
        parsedKey = new Date(key)
        parsedKey = parsedKey.setHours(12) // Add 12 hours. Each case only has the date it occurred. I'm presuming it's Eastern Time Zone, though, so add 12 hours in case there is an locale time zone adjustments when this key used as a timestamp in the browser or some situation like that and still reads the correct date. Not sure I have this right but it seems okay for now. 
        if(parsedKey) {
          acc[parsedKey] = value
        } else {
          console.info('oops', key)
        }
        return acc
      }, {})
    }

    Date.prototype.getWeek = (dateObj, dowOffset = 1) => { // https://stackoverflow.com/a/9047794/5935694 . Also, dowOffset ("Date of week offset", I think) is set to Monday to align with the ISO 8601 standard. https://en.wikipedia.org/wiki/Week#Week_numbering
      // dowOffset = typeof(dowOffset) == 'number' ? dowOffset : 0 //default dowOffset to zero
      // console.info(dowOffset)
      let newYear = new Date(dateObj.getFullYear(),0,1)
      let day = newYear.getDay() - dowOffset //the day of week the year begins on
      day = (day >= 0 ? day : day + 7)
      let daynum = Math.floor((dateObj.getTime() - newYear.getTime() - (dateObj.getTimezoneOffset()-newYear.getTimezoneOffset())*60000)/86400000) + 1

      const setToMonday = ( date ) => { // start of week
        let day = date.getDay() || 7;  
        if( day !== 1 ) 
            date.setHours(-24 * (day - 1)); 
        return date;
      }
      const setToSunday = ( date ) => { // end of week
        let day = date.getDay()  
        if( day !== 0 ) 
            date.setHours(24 * (7 - day)); 
        return date;
      }
      let weekStart = setToMonday(new Date(+(dateObj)))
      let weekEnd = setToSunday(new Date(+(dateObj)))

      let weeknum
      //if the year starts before the middle of a week
      if(day < 4) {
        weeknum = Math.floor((daynum+day-1)/7) + 1
        if(weeknum > 52) {
          nYear = new Date(dateObj.getFullYear() + 1,0,1)
          nday = nYear.getDay() - dowOffset
          nday = nday >= 0 ? nday : nday + 7
          /*if the next year starts before the middle of
            the week, it is week #1 of that year*/
          weeknum = nday < 4 ? 1 : 53
          // return `${weeknum === 53 ? newYear.getFullYear() : newYear.getFullYear() + 1}W${weeknum}`
          return {
            week: weeknum,
            year: weeknum === 53 ? newYear.getFullYear() : newYear.getFullYear() + 1,
            start: weekStart,
            end: weekEnd
          }
        } else {
          return {
            week: weeknum,
            year: newYear.getFullYear(),
            start: weekStart,
            end: weekEnd
          }
          // return `${newYear.getFullYear()}W${weeknum}`
        }
      } else {
        weeknum = Math.floor((daynum+day-1)/7)
        return {
          week: weeknum,
          year: newYear.getFullYear(),
          start: weekStart,
          end: weekEnd
        }
        // return `${newYear.getFullYear()}W${weeknum}`
      }
    }

    const sum = async (num1, num2) => { // utility function
      // if(isNaN(num1) || isNaN(num2)) console.info(num1, num2)
      num1 = !isNaN(num1) ? +(num1) || 0 : 0 // Casts the value passed to a Number. If it's a falsey value just assign it zero. 
      num2 = !isNaN(num2) ? +(num2) || 0 : 0
      return num1 + num2 
    }
    // End utility functions

    // let jhuData = await jhucsseScraper.fetchData()
    let jhuData = jhucsseScraper.fetchData

    jhuData = jhuData.map(thisJhu => thisJhu.data.map(thisRow => {
      thisRow.metric = thisJhu.name === 'confirmed_US' || thisJhu.name === 'confirmed_global' ? 'cases' : 'deaths'
      if(thisRow.iso2) return { // indicates US specific cases or deaths spreadsheet
        ...thisRow, 
        continentISO2: globals.countryToContinentISO2[thisRow.iso2], 
        continentName: globals.continentToNameISO2[globals.countryToContinentISO2[thisRow.iso2]],
        countryName: globals.countryToNameISO2[thisRow.iso2],
      }
      if(thisRow["Country/Region"]) { // indicates global cases or deaths spreadsheet
        if(thisRow["Country/Region"] === 'US') return null // US is the only location that has rows in both the US & global spreadsheets. Pull one out. I chose to remove the global US aggregates because I'd prefer to calculate my own aggregates for the US from the county data. 
        let hasMap = Object.entries(globals.countryToNameISO2).find(([, name]) => thisRow["Country/Region"] === name)
        if(hasMap) {
          return {
            ...thisRow, 
            countryISO2: hasMap[0],
            continentName: globals.continentToNameISO2[globals.countryToContinentISO2[hasMap[0]]],
            continentISO2: globals.countryToContinentISO2[hasMap[0]],
            countryName: hasMap[1],
          }
        } else { // Manual overrides because the country string provided by JHU does not match an ISO standard country name
          return {
            ...thisRow, 
            ...globals.stringToISOMap[thisRow["Country/Region"]],
          }
        }
      } 
    })).flat().filter(el => el) // Filter out the US Global stub (it's a falsey value). We already have a row for the US calculated with the US county aggregates.

    const getTimeTree = arrOfUnixTimestamps => { // An array of unix timestamps taken from the JHU data, ex. Object.keys(convertAllKeysThatAreDatesToUnixTimestamps(jhuData[0]))
      return arrOfUnixTimestamps.reduce((acc, current, currIdx, origArr) => {
        let unixTimestamp = current
        let date = new Date(+(unixTimestamp))
        let dateYear = date.getFullYear()
        let dateMonth = date.getMonth() + 1
        let thisWeeksMetadata = date.getWeek(new Date(+(date))) // Get week is not a part of native JavaScript. See utility functions.
        // console.info(date,dateYear,dateMonth,thisWeeksMetadata.week,thisWeeksMetadata.start,thisWeeksMetadata.end)
        // let defaultObj = { rolledUp: false, metrics: { cases: undefined, deaths: undefined }, subNodes: {} }
        // acc.daily = acc.daily ? acc.daily : { ...defaultObj }
        // acc.weekly = acc.weekly ? acc.weekly : { ...defaultObj }
        // console.info(dateMonth, thisWeeksMetadata, acc, dateYear, date)
        // acc.daily.subNodes[dateYear] = acc.daily.subNodes[dateYear] ? acc.daily.subNodes[dateYear] : { ...defaultObj }
        if(!(dateYear in acc.daily.subNodes)) {acc.daily.subNodes[dateYear] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} } }
        if(!(dateMonth in acc.daily.subNodes[dateYear].subNodes)) {acc.daily.subNodes[dateYear].subNodes[dateMonth] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} }}
        // acc.daily.subNodes[dateYear].subNodes[dateMonth] = acc.daily.subNodes[dateYear].subNodes[dateMonth] ? { ...acc.daily.subNodes[dateYear].subNodes[dateMonth] } : { ...defaultObj }
        if(!(unixTimestamp in acc.daily.subNodes[dateYear].subNodes[dateMonth].subNodes)) {acc.daily.subNodes[dateYear].subNodes[dateMonth].subNodes[unixTimestamp] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} }}
        // acc.daily.subNodes[dateYear].subNodes[dateMonth].subNodes[unixTimestamp] = { ...defaultObj } 
        acc.daily.subNodes[dateYear].subNodes[dateMonth].subNodes[unixTimestamp].metrics.cases = 0
        acc.daily.subNodes[dateYear].subNodes[dateMonth].subNodes[unixTimestamp].metrics.deaths = 0

        if(!(thisWeeksMetadata.year in acc.weekly.subNodes)) { acc.weekly.subNodes[thisWeeksMetadata.year] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} } }
        if(!(thisWeeksMetadata.week in acc.weekly.subNodes[thisWeeksMetadata.year].subNodes)) { acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} } }
        if(!(unixTimestamp in acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes)) { acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes[unixTimestamp] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} } }
        // acc.weekly.subNodes[thisWeeksMetadata.year] = acc.weekly.subNodes[thisWeeksMetadata.year] ? acc.weekly.subNodes[thisWeeksMetadata.year] : { ...defaultObj }
        // acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week] = acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week] ? { ...acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week] } : { ...defaultObj }
        // acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes[unixTimestamp] = { ...defaultObj }
        acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes[unixTimestamp].metrics.cases = 0
        acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes[unixTimestamp].metrics.deaths = 0
        // ^ Stored as two separate trees because the year a day is in can be different from the year a week is in. Example: The week with January 3rd in it is sometimes, technically, the 53rd week of the previous year. But January 3rd's "year" is the current year.

        acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].start = thisWeeksMetadata.start
        acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].end = thisWeeksMetadata.end

        // acc.weekYear = date.getWeek().year // This can differ from the actual year. Like lol ikr!?!? https://en.wikipedia.org/wiki/ISO_8601#Week_dates
        return acc
      }, {
          daily: { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} },
          weekly: { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} } 
        })
    }

    const updateTimeTree = async (timeTree, unixTimestamp, metric, value) => {
      let date = new Date(+(unixTimestamp))
      let dateYear = date.getFullYear()
      let dateMonth = date.getMonth() + 1
      let thisWeeksMetadata = date.getWeek(new Date(+(date))) // Get week is not a part of native JavaScript. See utility functions.

      timeTree.daily.subNodes[dateYear].subNodes[dateMonth].subNodes[unixTimestamp].metrics[metric] = value
      timeTree.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes[unixTimestamp].metrics[metric] = value
      return timeTree
    }

    const newJHUData = jhuData
    .map(thisRow => { return { ...thisRow, location: [ thisRow.continentName ] }})
    .map(thisRow => { return thisRow.countryName ? { ...thisRow, location: [ ...thisRow.location, thisRow.countryName] } : { ...thisRow } })
    .map(thisRow => { return thisRow["Province_State"] ? { ...thisRow, location: [ ...thisRow.location, thisRow["Province_State"]] } : { ...thisRow }})
    .map(thisRow => { return thisRow["Province/State"] ? { ...thisRow, location: [ ...thisRow.location, thisRow["Province/State"]] } : { ...thisRow }})
    .map(thisRow => { 
      if(thisRow["Admin2"]) {
        if(globals.Admin2Exclusions.includes(thisRow["Admin2"])) { // JHU data as some fill-ins where they didn't know the county (ex. "Out of NY")
          return { ...thisRow }
        } else {
          return { ...thisRow, location: [ ...thisRow.location, `${thisRow["Admin2"]}, ${thisRow["Province_State"]}`] }
        }
      } else {
        return { ...thisRow }
      }
    })
    .reduce((acc, curr, currIdx, origArr) => {
      let superRegions = [ acc.Earth ] // last superRegion is the current region being used as the parent
      let i = 0
      while(curr.location.length > i) {
        if(!superRegions[i].subregions[curr.location[i]]) { // if the subregion doesn't exist, create it. If it does, push found subregion to superregions array and bump search index.
          superRegions[i].subregions[curr.location[i]] = {
            getSuperRegion: () => { return superRegions[i] },
            superRegionName: superRegions[i].name,
            rolledUp: false,
            name: curr.location[i],
            subregions: {},
            totals: { 
              daily: { cases: {}, deaths: {} },
              cases: {}, deaths: {} // replacing the "daily" object, eventually
            },
            aggregates: getTimeTree(Object.keys(convertAllKeysThatAreDatesToUnixTimestamps(removeNonDateKeys(jhuData[0]))))
          }
          superRegions.push(superRegions[i].subregions[curr.location[i]])
        } else {
          superRegions.push(superRegions[i].subregions[curr.location[i]])
        }
        if(i + 1 === curr.location.length) { // If this is the last location (i.e. the most granular location data we have), update the appropriate metric.
          // const terribleProgrammingCurrentMetric = curr.metric
          superRegions[i].subregions[curr.location[i]].totals.daily[curr.metric] = limiter(convertAllKeysThatAreDatesToUnixTimestamps(removeNonDateKeys(curr)), limit)
          if(!("daily" in superRegions[i].subregions[curr.location[i]].aggregates)) {
            superRegions[i].subregions[curr.location[i]].aggregates = getTimeTree(Object.keys(convertAllKeysThatAreDatesToUnixTimestamps(removeNonDateKeys(jhuData[0]))))
          } else {
            Object.entries(superRegions[i].subregions[curr.location[i]].totals.daily[curr.metric])
            .forEach(dayWithMetrics => {
              // console.info(dayWithMetrics)
              updateTimeTree(superRegions[i].subregions[curr.location[i]].aggregates, dayWithMetrics[0], curr.metric, dayWithMetrics[1] )
            })
          }
          
          
          // = { ...superRegions[i].subregions[curr.location[i]].aggregates, ...Object.entries(superRegions[i].subregions[curr.location[i]].totals.daily[curr.metric])
          // .reduce((acc, current, currIdx, origArr) => {
          //   let [unixTimestamp, metricCount] = current
          //   // console.info(curr.metric, metricCount)
          //   let date = new Date(+(unixTimestamp))
          //   let dateYear = date.getFullYear()
          //   let dateMonth = date.getMonth() + 1
          //   let thisWeeksMetadata = date.getWeek(new Date(+(date))) // Get week is not a part of native JavaScript. See utility functions.
          //   // console.info(date,dateYear,dateMonth,thisWeeksMetadata.week,thisWeeksMetadata.start,thisWeeksMetadata.end)
          //   // let defaultObj = { rolledUp: false, metrics: { cases: undefined, deaths: undefined }, subNodes: {} }
          //   // acc.daily = acc.daily ? acc.daily : { ...defaultObj }
          //   // acc.weekly = acc.weekly ? acc.weekly : { ...defaultObj }
          //   // console.info(dateMonth, thisWeeksMetadata, acc, dateYear, date)
          //   // acc.daily.subNodes[dateYear] = acc.daily.subNodes[dateYear] ? acc.daily.subNodes[dateYear] : { ...defaultObj }
          //   if(!(dateYear in acc.daily.subNodes)) {acc.daily.subNodes[dateYear] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} } }
          //   if(!(dateMonth in acc.daily.subNodes[dateYear].subNodes)) {acc.daily.subNodes[dateYear].subNodes[dateMonth] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} }}
          //   // acc.daily.subNodes[dateYear].subNodes[dateMonth] = acc.daily.subNodes[dateYear].subNodes[dateMonth] ? { ...acc.daily.subNodes[dateYear].subNodes[dateMonth] } : { ...defaultObj }
          //   if(!(unixTimestamp in acc.daily.subNodes[dateYear].subNodes[dateMonth].subNodes)) {acc.daily.subNodes[dateYear].subNodes[dateMonth].subNodes[unixTimestamp] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} }}
          //   // acc.daily.subNodes[dateYear].subNodes[dateMonth].subNodes[unixTimestamp] = { ...defaultObj } 
          //   acc.daily.subNodes[dateYear].subNodes[dateMonth].subNodes[unixTimestamp].metrics[curr.metric] = metricCount

          //   if(!(thisWeeksMetadata.year in acc.weekly.subNodes)) { acc.weekly.subNodes[thisWeeksMetadata.year] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} } }
          //   if(!(thisWeeksMetadata.week in acc.weekly.subNodes[thisWeeksMetadata.year].subNodes)) { acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} } }
          //   if(!(unixTimestamp in acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes)) { acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes[unixTimestamp] = { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} } }
          //   // acc.weekly.subNodes[thisWeeksMetadata.year] = acc.weekly.subNodes[thisWeeksMetadata.year] ? acc.weekly.subNodes[thisWeeksMetadata.year] : { ...defaultObj }
          //   // acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week] = acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week] ? { ...acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week] } : { ...defaultObj }
          //   // acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes[unixTimestamp] = { ...defaultObj }
          //   acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes[unixTimestamp].metrics[curr.metric] = metricCount
          //   // if(superRegions[i].subregions[curr.location[i]].name === 'Albania') console.info(acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes[unixTimestamp].metrics.cases, acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].subNodes[unixTimestamp].metrics.deaths)
          //   // ^ Stored as two separate trees because the year a day is in can be different from the year a week is in. Example: The week with January 3rd in it is sometimes, technically, the 53rd week of the previous year. But January 3rd's "year" is the current year.

          //   acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].start = thisWeeksMetadata.start
          //   acc.weekly.subNodes[thisWeeksMetadata.year].subNodes[thisWeeksMetadata.week].end = thisWeeksMetadata.end

          //   // console.info(`Daily (${curr.metric}): ${metricCount}`,`Weekly (${curr.metric}): ${metricCount}` )

          //   // acc.weekYear = date.getWeek().year // This can differ from the actual year. Like lol ikr!?!? https://en.wikipedia.org/wiki/ISO_8601#Week_dates
          //   return acc
          // }, {
          //     daily: { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} },
          //     weekly: { rolledUp: false, metrics: { cases: 0, deaths: 0 }, subNodes: {} } 
          //   }) }


          // console.info(superRegions[i].subregions[curr.location[i]].name, JSON.stringify(superRegions[i].subregions[curr.location[i]]))
          // console.info(' ')
        }
        // console.info(' ')
        i++
      }
      return acc
    }, { Earth: {
      name: "Earth",
      rolledUp: false,
      subregions: {},
      superRegionName: null,
      totals: { daily: { cases: {}, deaths: {} } },
      aggregates: getTimeTree(Object.keys(convertAllKeysThatAreDatesToUnixTimestamps(removeNonDateKeys(jhuData[0]))))
    }})

    const findLocation = (str, obj) => {
      let match = null
      if(str === obj.name) {
        match = obj
        return match
      }
      if(Object.entries(obj.subregions).length > 0) {
        for (let [key, thisSubregion] of Object.entries(obj.subregions)) {
          match = findLocation(str, thisSubregion)
          if(!match) {
            // do nothing
          } else {
            return match
          }
        }
      }
      return match
    }

    const calculatedDerivedMetrics = (casesObj, deathsObj, locationName) => { // Pass a case or death object. Presumed the structure is { "1/22/20": ##, "1/23/20": ##, ...  }
      const calcChange = obj => {
        return Object.entries(obj).reverse().reduce((acc, curr, currIdx, origArr) => {
          let [countDate, count] = curr
          let yesterdaysCount = currIdx === 0 ? 0 : origArr[currIdx - 1][1] // Oof. This mess, origArr[currIdx - 1][1][1], is the previous day's count. Don't @ me.
          yesterdaysCount = +(yesterdaysCount) || 0
          let todaysCount = +(count) || 0
          acc.change[countDate] = todaysCount - yesterdaysCount
          acc.changePercent[countDate] = Number((acc.change[countDate] / todaysCount) * 100).toFixed(2)
          return acc
        }, { change: {}, changePercent: {}})
      }

      let casesResults = calcChange(casesObj)
      let deathsResults = calcChange(deathsObj)

      let caseChange = sortObj(casesResults.change)
      let caseChangePercent = sortObj(casesResults.changePercent)
      let deathsChange = sortObj(deathsResults.change)
      let deathsChangePercent = sortObj(deathsResults.changePercent)
      let survivalRate = {} // returns the percentage chance of survival

      try {
        if(Object.keys(casesObj).toString() === Object.keys(casesObj).toString(deathsObj) ) { // if they have the same keys
          Object.keys(casesObj).forEach((thisKey, currIdx) => { // Just need the list of keys from one object to iterate with 
            let [deathsDate, deathsCount] = [thisKey, deathsObj[thisKey]] // lazy
            let [casesDate, casesCount] = [thisKey, casesObj[thisKey]] // lazy again :-) 
            if(deathsDate !== casesDate) throw new Error('Case and death dates are different when calculating survival rate.')
            let deathsToNum = +(deathsCount) || 0
            let casesToNum = +(casesCount) || 0
            let survivalRateCalc = +(deathsToNum / casesToNum) || 0 // another type conversion because 0/0 returns NaN
            survivalRate[casesDate] = 100 - Number(survivalRateCalc * 100).toFixed(2) // Could use either date because they should be the same. An error would be thrown otherwise.
          })
        } else {
          throw new Error(`${locationName} does not have matching case and death date keys.`)
        }
        //^ Check to see that the cases and deaths objects have the same number and type of keys (Object.keys & stringify & compare). Loop over one of the objects, generating a new object with newObj[key] = death[key] / casesObj[key]
        return {
          caseChange,
          caseChangePercent,
          deathsChange,
          deathsChangePercent,
          survivalRate
        }
      } catch(err) {
        console.error(err)
        return {
          dailyChange,
          dailyChangePercent,
          survivalRate
        }
      }
    }

    const calcAggs = async location => {
      if(location.rolledUp) return location
//       console.debug(`
// ${location.name} (${location.superRegionName})
// ${Object.entries(location.subregions).length} (subregion count)
// ${!location.rolledUp} & ${Object.entries(location.subregions).every(([key, value]) => value.rolledUp)} (is not rolled up & subregions are rolled up)`)
// ^Leaving in for debugging purposes
      if(Object.keys(location.subregions).length === 0) {
        let derivedMetrics = calculatedDerivedMetrics(sortObj(location.totals.daily.cases), sortObj(location.totals.daily.deaths), location.name)
        location.totals.daily = { ...location.totals.daily, ...derivedMetrics }
        location.rolledUp = true
        return location
      } else {
        const sum = (num1, num2) => { // utility function
          num1 = +(num1) || 0 // Casts the value passed to a Number. If it's a falsey value just assign it zero. 
          num2 = +(num2) || 0
          return num1 + num2 
        }

        while(true) { // Hold up until all the subregions have calculated their aggregates. 
          for (let [key, value] of Object.entries(location.subregions)) {
            await calcAggs(value) // Basically, roll up all the subregions, then continue. Don't process other things until the subregions are finished processing. The subregions won't finish until their subregions are 
          }
          if(Object.entries(location.subregions).every(([key, value]) => value.rolledUp)) {
            break
          }
        }

        let subregionKeys = Object.keys(location.subregions)
        let i = 0
        while(i < subregionKeys.length) {
          let caseDatesLeft = Object.keys(location.subregions[subregionKeys[i]].totals.daily.cases)
          let deathDatesLeft = Object.keys(location.subregions[subregionKeys[i]].totals.daily.deaths)
          while(caseDatesLeft.length > 0 || deathDatesLeft.length > 0) { // Get case and death totals
            let thisCasesKey = caseDatesLeft.pop()
            let thisDeathKey = deathDatesLeft.pop()
            if(thisCasesKey) {
              location.totals.daily.cases[thisCasesKey] = sum(location.totals.daily.cases[thisCasesKey], location.subregions[subregionKeys[i]].totals.daily.cases[thisCasesKey]) 
            }
            if(thisDeathKey) {
              location.totals.daily.deaths[thisDeathKey] = sum(location.totals.daily.deaths[thisDeathKey], location.subregions[subregionKeys[i]].totals.daily.deaths[thisDeathKey]) 
            }
          }
          i++
        }
        let derivedMetrics = calculatedDerivedMetrics(sortObj(location.totals.daily.cases), sortObj(location.totals.daily.deaths), location.name)
        location.totals.daily = { ...location.totals.daily, ...derivedMetrics }
        location.rolledUp = true
        return location
      }
    }

    const rollupMetrics = async timeNode => { // aggregates: {daily: subNodes:[{[year]: subNodes: [{[month]: subNodes: [{[unixTimestamp]: #}] }] }, weekly: {[year]: {[week]: {[unixTimestamp]: #}}}
      if(timeNode.rolledUp) 
        return timeNode // termination condition

//       console.debug(`
// ${Object.keys(timeNode.subNodes)}
// ${!timeNode.rolledUp} & ${Object.entries(timeNode.subregions).every(([key, value]) => value.rolledUp)} (is not rolled up & subregions are rolled up)`)
// ^Leaving in for debugging purposes
      // console.info(timeNode)
      // console.info(Object.keys(timeNode.subNodes).length === 0)
      if(Object.keys(timeNode.subNodes).length === 0) {
        // if(timeNode.metrics.cases > 0) console.info(timeNode.metrics.cases)
        timeNode.rolledUp = true
        return timeNode
      } else {
        while(true) { // sum child nodes
          for (let [key, value] of Object.entries(timeNode.subNodes)) {
            // console.info(key, value)
            if(key === 'rolledUp' || key === 'metrics') continue
            if(!value.rolledUp) {
              await rollupMetrics(value)
            }
             // Basically, roll up all the subregions, then continue. Don't process other things until the subregions are finished processing. The subregions won't finish until their subregions are 
          }
          // console.info(Object.entries(timeNode.subNodes).every(([key, value]) => {
          //   console.info(value)
          // }))
          if(Object.entries(timeNode.subNodes).every(([key, value]) => value.rolledUp)) {
            // console.info('breaking loop')
            break
          }
        }
  
        // sum current node
        // let subNodeKeys = Object.keys(timeNode.subNodes)
        let greatestSubNodeKey = Object.keys(timeNode.subNodes).sort((key1, key2) => key2 - key1)[0]
        // let i = 0
        // while(i < subNodeKeys.length) {
        timeNode.metrics.cases = timeNode.subNodes[greatestSubNodeKey].metrics.cases
        timeNode.metrics.deaths = timeNode.subNodes[greatestSubNodeKey].metrics.deaths
        // console.info(timeNode.metrics.cases, timeNode.metrics.deaths)
          // timeNode.metrics.cases = sum(timeNode.metrics.cases, timeNode.subNodes[subNodeKeys[i]].metrics.cases) 
          // timeNode.metrics.deaths = sum(timeNode.metrics.deaths, timeNode.subNodes[subNodeKeys[i]].metrics.deaths) 
          // i++ 
        // }
  
  
        // calculate derived metrics 
  
  
        timeNode.rolledUp = true
        return timeNode
      }
    }

    const calcAggs2 = async location => {
      if(location.rolledUp) return location
//       console.debug(`
// ${location.name} (${location.superRegionName})
// ${Object.entries(location.subregions).length} (subregion count)
// ${!location.rolledUp} & ${Object.entries(location.subregions).every(([key, value]) => value.rolledUp)} (is not rolled up & subregions are rolled up)`)
// ^Leaving in for debugging purposes
      if(Object.keys(location.subregions).length === 0) {
        let derivedMetrics = calculatedDerivedMetrics(sortObj(location.totals.daily.cases), sortObj(location.totals.daily.deaths), location.name)
        location.totals.daily = { ...location.totals.daily, ...derivedMetrics }
        
        location.rolledUp = true
        return location
      } else {

        while(true) { // Hold up until all the subregions have calculated their aggregates. 
          for (let [key, value] of Object.entries(location.subregions)) {
            await calcAggs2(value) // Basically, roll up all the subregions, then continue. Don't process other things until the subregions are finished processing. The subregions won't finish until their subregions are 
            value.aggregates.daily = await rollupMetrics(value.aggregates.daily)
            value.aggregates.weekly = await rollupMetrics(value.aggregates.weekly)
          }
          if(Object.entries(location.subregions).every(([key, value]) => value.rolledUp && value.aggregates.daily.rolledUp && value.aggregates.weekly.rolledUp)) {
            break
          }
        }

        let subregionKeys = Object.keys(location.subregions)
        let i = 0
        while(i < subregionKeys.length) {
          let caseDatesLeft = Object.keys(location.subregions[subregionKeys[i]].totals.daily.cases)
          let deathDatesLeft = Object.keys(location.subregions[subregionKeys[i]].totals.daily.deaths)
          while(caseDatesLeft.length > 0 || deathDatesLeft.length > 0) { // Get case and death totals
            let thisCasesKey = caseDatesLeft.pop()
            let thisDeathKey = deathDatesLeft.pop()
            if(thisCasesKey) {
              // if(isNaN(location.totals.daily.cases[thisCasesKey])) { 
              //   console.info(location.totals.daily.cases[thisCasesKey], thisCasesKey)
              // } else {
              //   console.info('good ', location.totals.daily.cases[thisCasesKey], thisCasesKey)
              // }
              location.totals.daily.cases[thisCasesKey] = await sum(location.totals.daily.cases[thisCasesKey], location.subregions[subregionKeys[i]].totals.daily.cases[thisCasesKey]) 
              location.aggregates = await updateTimeTree(location.aggregates, thisCasesKey, 'cases', location.totals.daily.cases[thisCasesKey] )
            }
            if(thisDeathKey) {
              location.totals.daily.deaths[thisDeathKey] = await sum(location.totals.daily.deaths[thisDeathKey], location.subregions[subregionKeys[i]].totals.daily.deaths[thisDeathKey]) 
              location.aggregates = await updateTimeTree(location.aggregates, thisDeathKey, 'deaths', location.totals.daily.deaths[thisDeathKey] )
            }
          }
          i++
        }
        let derivedMetrics = calculatedDerivedMetrics(sortObj(location.totals.daily.cases), sortObj(location.totals.daily.deaths), location.name)
        location.totals.daily = { ...location.totals.daily, ...derivedMetrics }
        location.rolledUp = true

        location.aggregates.daily = await rollupMetrics(location.aggregates.daily)
        location.aggregates.weekly = await rollupMetrics(location.aggregates.weekly)

        return location
      }
    }

    // let jhuDataAggregated = await calcAggs(newJHUData.Earth)
    let jhuDataAggregated = await calcAggs2(newJHUData.Earth)
    jhuDataAggregated = [ { data: jhuDataAggregated }, { meta: { lastUpdated: (new Date).toISOString(), limit }} ]
    /* calcAggs schema
{
  name: 'Earth',
  rolledUp: true,
  subregions: { // The continents and their "subregions" (i.e. countries)}
  },
  superRegionName: null,
  totals: { daily: { cases: { // Object with date: aggregate counts as key: value pairs from January 22nd }, deaths: { // Object with date: aggregate counts as key: value pairs from January 22nd } } }
}
    */

    // return jhuDataAggregated
    console.info(JSON.stringify(jhuDataAggregated[0].data.subregions["Europe"].subregions["Albania"]))
    // console.info(JSON.stringify(jhuDataAggregated[0].data.subregions["North America"].subregions["United States"].subregions["Rhode Island"]))
    // console.info(JSON.stringify(jhuDataAggregated[0].data.subregions["Europe"]))
  } catch(err) {
    console.error(err)
    return err
  } 
} // >> into dev/whatever.json in terminal for dev