const globals = require('./globals');
const jhucsseScraper = require("./jhucsseTest")
const allPops = require("./mergePopulationSources")
// const jhucsseScraper = require("./jhucsse")


exports.create = async (limit = null) => {
  try {

    // Utility functions
    const sum = async (num1, num2) => { // utility function
      num1 = Number.isNaN(+(num1)) ? 0 : num1 // Handles cases where undefined or strings are passed
      num2 = Number.isNaN(+(num2)) ? 0 : num2
      num1 = +(num1) || 0 // Casts the value passed to a Number. If it's a falsey value just assign it zero. 
      num2 = +(num2) || 0
      return num1 + num2 
    }

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

    const convertAllKeysThatAreDatesToUnixTimestamps = (obj) => {
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
    // End utility functions

    // let jhuData = await jhucsseScraper.fetchData()
    let jhuData = await jhucsseScraper.fetchData

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
          return { ...thisRow, location: [ ...thisRow.location, 
            `${
              thisRow["Province_State"] === 'Louisiana' // Louisiana calls them "Parishes". Leaving these alone and removing "Parish" from the population data.
              ? `${thisRow["Admin2"]}, ${thisRow["Province_State"]}` 
              : thisRow["Province_State"] === 'Alaska'
              ? `${thisRow["Admin2"]}, ${thisRow["Province_State"]}`
              : thisRow["Admin2"] === 'Baltimore City'
              ? `${thisRow["Admin2"]}, ${thisRow["Province_State"]}`
              : thisRow["Admin2"] === 'St. Louis City'
              ? `${thisRow["Admin2"]}, ${thisRow["Province_State"]}`
              : thisRow["Admin2"] === 'Carson City'
              ? `${thisRow["Admin2"]}, ${thisRow["Province_State"]}`
              : thisRow["Admin2"].includes('County') // Alaska calls them "Boroughs". Leaving these alone and removing "Boroughs" from the population data.
              ? `${thisRow["Admin2"]}, ${thisRow["Province_State"]}`
              : `${thisRow["Admin2"]} County, ${thisRow["Province_State"]}`
            }`
          ]}
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
            totals: { daily: { cases: {}, deaths: {} } }
          }
          superRegions.push(superRegions[i].subregions[curr.location[i]])
        } else {
          superRegions.push(superRegions[i].subregions[curr.location[i]])
        }
        if(i + 1 === curr.location.length) { // If this is the last location (i.e. the most granular location data we have), update the appropriate metric.
          superRegions[i].subregions[curr.location[i]].totals.daily[curr.metric] = limiter(convertAllKeysThatAreDatesToUnixTimestamps(removeNonDateKeys(curr)), limit)
        }
        i++
      }
      return acc
    }, { Earth: {
      name: "Earth",
      rolledUp: false,
      subregions: {},
      superRegionName: null,
      totals: { daily: { cases: {}, deaths: {} } }
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

    let jhuDataAggregated = await calcAggs(newJHUData.Earth)
    jhuDataAggregated = [ { data: jhuDataAggregated }, { meta: { lastUpdated: (new Date).toISOString(), limit }} ]

    const addPerCapitaMetric = (locationNode, srcMetric) => {
      locationNode.totals.daily[`${srcMetric}Per100000`] = Object.entries(locationNode.totals.daily[srcMetric])
      .reduce((acc, curr, currIdx, origArr) => {
        let [unixTimestamp, value] = curr
        acc[unixTimestamp] = Number(100000 * (+(value) / +(locationNode.population))).toFixed(2)
        return acc
      }, {})
    }

    const allPopulations = await globals.allPops // I'd rather not have globals return a promise because that feels weird, but here we are.
    
    Object.entries(allPopulations).forEach(thisPop => {
      let [thisPopLoc, thisPopCount] = thisPop
      let locationNode = findLocation(thisPopLoc, jhuDataAggregated[0].data)
      if(!locationNode) {
        // console.info(`No pop for ${thisPopLoc}`) // There are several locations that do not have a population mapping at the moment. Each is their own issue to debug. Example: Virginia cities *might* not be included in the county population the city resides in. In which case a mapping of cities to their counties with an aggregate calculation would need to be created. I'm not gonna do that right now. Sometime! Will open an issue on github later. 
        return undefined
      } else {
        locationNode.population = thisPopCount
        addPerCapitaMetric(locationNode, 'cases')
        addPerCapitaMetric(locationNode, 'deaths')
        addPerCapitaMetric(locationNode, 'caseChange')
        addPerCapitaMetric(locationNode, 'deathsChange')
      }
    })

    const sumSubregionPopulations = async locationNode => {
      let subTotalPop = 0
      let subregionKeys = Object.keys(locationNode.subregions)
      while(subregionKeys.length > 0) {
        let thisSubregionKey = subregionKeys.pop()
        if("population" in locationNode.subregions[thisSubregionKey]) {
          subTotalPop = subTotalPop + await sum(locationNode.population, locationNode.subregions[thisSubregionKey].population)
        }
      }
      locationNode.population = subTotalPop
    }

    // This next bit purposefully only sums the populations for the continents and the Earth because we have populations for nearly all the countries, but not at the continent or planet level
    let earthSubregionKeys = Object.keys(jhuDataAggregated[0].data.subregions)
    while(earthSubregionKeys.length > 0) {
      let thisEarthSubregionKey = earthSubregionKeys.pop()
      await sumSubregionPopulations(jhuDataAggregated[0].data.subregions[thisEarthSubregionKey])
      addPerCapitaMetric(jhuDataAggregated[0].data.subregions[thisEarthSubregionKey], 'cases')
      addPerCapitaMetric(jhuDataAggregated[0].data.subregions[thisEarthSubregionKey], 'deaths')
      addPerCapitaMetric(jhuDataAggregated[0].data.subregions[thisEarthSubregionKey], 'caseChange')
      addPerCapitaMetric(jhuDataAggregated[0].data.subregions[thisEarthSubregionKey], 'deathsChange')
    }
    await sumSubregionPopulations(jhuDataAggregated[0].data)
    addPerCapitaMetric(jhuDataAggregated[0].data, 'cases')
    addPerCapitaMetric(jhuDataAggregated[0].data, 'deaths')
    addPerCapitaMetric(jhuDataAggregated[0].data, 'caseChange')
    addPerCapitaMetric(jhuDataAggregated[0].data, 'deathsChange')

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
    console.info(jhuDataAggregated[0].data)
    // console.info(JSON.stringify(globals.countryPopulations[0].fields))
  } catch(err) {
    console.error(err)
    return err
  } 
} // >> into dev/whatever.json in terminal for dev