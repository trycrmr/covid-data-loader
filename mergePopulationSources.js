const csv = require('csvtojson')

const countyPops = './USCountyPopulationsJul12019.csv' // https://www.census.gov/data/tables/time-series/demo/popest/2010s-counties-total.html
const countryPops = './CountryPopulationsJul12019.csv' // https://population.un.org/wpp/Download/Standard/Population/

const getJSON = (async () => {
  let pops = await Promise.all([csv().fromFile(countyPops), csv().fromFile(countryPops)])
  let allPops = [...pops[0], ...pops[1]]
    .reduce((acc, curr, currIdx, origArr) => {
      if("UNCountryNames" in curr) {
        // console.info(curr)
        acc[curr.UNCountryNames] = curr.UNCountryPopulationEstimatesJul12019
      } else {
        if(curr.CTYNAME) {
          acc[`${curr.CTYNAME}, ${curr.STNAME}`] = curr.POPESTIMATE2019
        } else {
          acc[`${curr.STNAME}`] = curr.POPESTIMATE2019
        }
      }
      return acc
    }, {})

  return allPops
})()

module.exports = getJSON