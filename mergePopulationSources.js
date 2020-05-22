const csv = require('csvtojson')

const countyPops = './USCountyPopulationsJul12019.csv' // https://www.census.gov/data/tables/time-series/demo/popest/2010s-counties-total.html
const countryPops = './CountryPopulationsJul12019.csv' // https://population.un.org/wpp/Download/Standard/Population/
const chinaPopsByProvince = './2018ChinaPopulationByProvince.csv' // http://data.stats.gov.cn/english/easyquery.htm?cn=E0103 
const canadaPopsByProvince = './July2019CanadianPopulationsByProvince.csv' // https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000901
const australiaPopsByProvince = './June2019AustralianPopulationsByProvince.csv' // http://stat.data.abs.gov.au/Index.aspx?DataSetCode=ERP_QUARTERLY

const getJSON = (async () => {
  let pops = await Promise.all([csv().fromFile(countyPops), csv().fromFile(countryPops), csv().fromFile(chinaPopsByProvince), csv().fromFile(canadaPopsByProvince), csv().fromFile(australiaPopsByProvince)])
  let allPops = Object.entries({ countyPops: pops[0], countryPops: pops[1], chinaPopsByProvince: pops[2], canadaPopsByProvince:pops[3], australiaPopsByProvince: pops[4] })
    .reduce((acc, curr, currIdx, origArr) => {
      let [csvFileNickname, data] = curr
      switch(csvFileNickname) {
        case 'countyPops':
          acc = { ...acc, ...data.reduce((acc, curr, currIdx, origArr) => {
            if(curr.CTYNAME) {
              acc[`${curr.CTYNAME}, ${curr.STNAME}`] = curr.POPESTIMATE2019
            } else {
              acc[`${curr.STNAME}`] = curr.POPESTIMATE2019
            }
            return acc
          }, {})}
          break
        case 'countryPops':
          acc = { ...acc, ...data.reduce((acc, curr, currIdx, origArr) => {
            acc[curr.UNCountryNames] = curr.UNCountryPopulationEstimatesJul12019
            return acc
          }, {})}
          break
        case 'chinaPopsByProvince':
          acc = { ...acc, ...data.reduce((acc, curr, currIdx, origArr) => {
            acc[`${curr["Region"]}, China`] = Number(+(curr["2018"]) * 10000).toFixed(0)
            return acc
          }, {})}
          break
        case 'canadaPopsByProvince':
          acc = { ...acc, ...data.reduce((acc, curr, currIdx, origArr) => {
            acc[`${curr["GEO"]}, Canada`] = curr["VALUE"]
            return acc
          }, {})}
          break
        case 'australiaPopsByProvince':
          acc = { ...acc, ...data.reduce((acc, curr, currIdx, origArr) => {
            acc[`${curr["State"]}, Australia`] = curr["Value"]
            return acc
          }, {})}
          break
        default: 
          console.info(`Shouldn't get here.`)
          break // should never get here
      }
      return acc
    }, {})

  return allPops
})()

module.exports = getJSON