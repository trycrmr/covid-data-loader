# Non-code contributions
- Go to https://coviddata.website. Select as many of the different combinations of the filters you can conceive of. Open an issue for anything strange in the data you notice. 

#  Install / Code contributions
1. Fork the repo (click the button in the top right your Github interface)
2. Clone the repo (SSH: `git clone git@github.com:trycrmr/covid-data-loader.git` or HTTPS: `git clone https://github.com/trycrmr/covid-data-loader.git`)
3. Add covid-data-loader as an upstream repo (`git remote add upstream https://github.com/trycrmr/covid-data-loader.git`)
4. `npm i` to install the required dependencies. `node index.js` to fetch, transform, and output the data as json files under the ./dev folder. 
5. Create a new branch named on your forked repo with the following convention: "[issue-number][1-3 words summarizing the issue]" (Example: "19-new-covid-vaccine"). If an issue doesn't exist, open one, reference it, and start working on it. 
6. Open all PRs into master of the upstream repo. Must maintain feature & performance parity. No PRs that vary from the branch naming convention or have merge conflicts with master will be accepted as well.
7. Your PR will be reviewed shortly. In the meantime, repeat steps #5 & #6! 
