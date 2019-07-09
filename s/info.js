
function getInfo(initialInfo){
	var rate = fetch("https://api.etherscan.io/api?module=stats&action=ethprice&apikey=YourApiKeyToken")
		.then(function(response){
		    document.getElementById('guarantee').style.display = 'none';
			return response.json();
        }).catch(function(e){
            document.getElementById('guarantee').style.display = 'block';
        });
	var defLastBlock = 0;
	if(!initialInfo)
		initialInfo = {address: '0xdf17e8cc5d8020acb11af5178715cce6600d1c98', sum: 0, timesum: 0, num: 0, investors: {}, prizes: [], prizesMap: {}, dates: [], nums: [], sums: [], min: -1, max: 0};
	if(!initialInfo.address) initialInfo.address = '0xdf17e8cc5d8020acb11af5178715cce6600d1c98';
	var txall = {};

	var jsonInternalPromise = fetch("https://api-rinkeby.etherscan.io/api?module=account&action=txlistinternal&address=" + initialInfo.address + "&startblock=" + ((initialInfo.lastBlockInner || initialInfo.lastBlock || defLastBlock) + 1) + "&endblock=99999999&sort=asc&apikey=YourApiKeyToken")
		.then(function(response){
			return response.json();
		}).then(function(json){
			for(let i=0; i<json.result.length; ++i){
				let t = json.result[i];
				let tri = txall[t.hash];
				if(!tri)
					tri = txall[t.hash] = {out: []};
				if(!tri.out)
				    tri.out = [];
				tri.out.push(t);
			}
			return json;
		});

    var jsonPromise = fetch("https://api-rinkeby.etherscan.io/api?module=account&action=txlist&address=" + initialInfo.address + "&startblock=" + ((initialInfo.lastBlock || defLastBlock) + 1) + "&endblock=99999999&sort=asc&apikey=YourApiKeyToken")
        .then(function(response){
            return response.json();
        }).then(function(json){
            for(let i=0; i<json.result.length; ++i){
                let t = json.result[i];
                let tri = txall[t.hash];
                if(!tri)
                    tri = txall[t.hash] = {};
                tri.inn = t;
            }
            return json;
        }, function(e){
            console.error('Error fetching internal transactions: ', e);
            return {result: []};
        });

	function gatherTxIn(info, tr){
		var val = +tr.value;

		if(info.investors[tr.from]){
			info.investors[tr.from].gas += tr.gasUsed * tr.gasPrice;
		}else{
			info.investors[tr.from] = {
				sum: 0,
				inv: [],
				gas: tr.gasUsed * tr.gasPrice
			}
		}

		if(+tr.isError)
			return info;

		let trx = txall[tr.hash];
		let inn = +trx.inn.value;
		let out = (trx.out || []).reduce((acc, t) => acc += +t.value, 0);
		
		if(val && out <= inn + 0.00000001){
			info.last = val;
			info.last_time = tr.timeStamp * 1000;
		
			info.sum += val;
			info.timesum += val*tr.blockNumber;

			var inv = info.investors[tr.from];
			if(!inv.sum)
				info.num += 1;

			inv.sum += val;
			inv.inv.push({
				sum: val,
				time: info.last_time
			});

			var investment = info.investors[tr.from].sum;
			
			info.dates.push(info.last_time);
			info.nums.push(info.num);
			info.sums.push(Math.round(info.sum/Math.pow(10,16))/100);
		
			if(info.min == -1 || info.min > investment)
				info.min = investment;
			if(investment > info.max)
				info.max = investment;
		}else if(tr.to && trx.out){ //prize transations, skip contract creation
			var prize = {
				hash: tr.hash,
				timeStamp: +tr.timeStamp,
			};

            let itr = trx.out.find(v => v.to !== trx.inn.from || v.value !== trx.inn.value);
            prize.sum = +itr.value;
            prize.addr = itr.to;

			info.prizes.push(tr.hash);
			info.prizesMap[tr.hash] = prize;
		}
		return info;
	}

    return Promise.all([jsonInternalPromise, jsonPromise]).then(function(jsons){
            var json = jsons[1];
            var jsonInternal = jsons[0];

			var info = json.result.reduce(function(info, tr){
				if(!info.firstBlock){
					info.firstBlock = +tr.blockNumber;
					info.firstTime = +tr.timeStamp;
				}
				info.lastBlock = +tr.blockNumber;
				info.lastTime = +tr.timeStamp;

				return gatherTxIn(info, tr);
			}, initialInfo);

			info.avg = info.sum/info.num;

			return rate.then(function(ratejson){
				info.rate = +ratejson.result.ethusd;
				info.sum_usd = info.sum/Math.pow(10, 18) * info.rate;
				const contractAddress = info.address.toLowerCase();

				return jsonInternal.result.reduce(function(info, tr){
                    info.lastBlockInner = +tr.blockNumber;
                    info.lastTimeInner = +tr.timeStamp;

                    if(!(+tr.isError)){
                        if(tr.to.toLowerCase() === contractAddress){
                            info = gatherTxIn(info, tr);
                        }else if(tr.from.toLowerCase() === contractAddress){
                            var inv = info.investors[tr.to];
                            if(inv){
                                inv.got = (inv.got || 0) + (+tr.value);
                                inv.gotTime = tr.timeStamp*1000;
                            }
                            info.got = (info.got || 0) + (+tr.value);
                        }
                    }
                    return info;
                }, info);
			});

		});
}

function drawChart(info){
    if (document.getElementById('chart-container2')) {
    	var avg = (Math.round(info.avg/Math.pow(10,16))/100);
    	var min = (Math.ceil(info.min/Math.pow(10,16))/100);
    	var max = (Math.round(info.max/Math.pow(10,16))/100);
        Highcharts.chart('chart-container2', {
            /*tooltip: {
              /*  formatter: function () {
    
                    if (this.series.name == 'AVG') {
                        return '<b>' + this.key + '</b><br/>';
                    } else {
                        return '<b>' + this.series.name + '</b><br/>' +
                            new Date(this.x) + ': ' + this.y;
                    }
                }
            }, */
            title: {
                text: 'Combination chart',
                style: {
                	color: (Highcharts.theme && Highcharts.theme.textColor) || 'white'
                }
            },
            xAxis: {
                type: 'datetime',
                dateTimeLabelFormats: { // don't display the dummy year
    				day: '%e %b',
    				week: '%e %b',
                    month: '%e %b',
                    year: '%e %b'
                },
                title: {
                    enabled: false
                }
            },
            labels: {
                items: [{
                    html: 'Average ' + avg + 'ETH, max ' + max + ' ETH',
                    style: {
                        left: '50px',
                        top: '18px',
                        color: (Highcharts.theme && Highcharts.theme.textColor) || 'white'
                    }
                }]
            },
            legend: {
                itemStyle: {
                    color: '#A0A0A0'
                },
                itemHoverStyle: {
                    color: '#FFF'
                },
                itemHiddenStyle: {
                    color: '#444'
                }
            },
            yAxis: [{
                labels: {
                    enabled: true
                },
                title: {
                    enabled: false
                },
                minorGridLineWidth: 0.2,
                gridLineWidth: 0.1,
                alternateGridColor: null,
            }],
    
            plotOptions: {
                column: {},
                spline: {
                    dashStyle: 'Dot',
                    marker: {enabled: false},
                    states: {hover: {enabled: true}},
                },
                area: {
                    marker: {enabled: false},
                    states: {hover: {enabled: true}},
                    style: 'dotted',
                    fillOpacity: 0.2,
                },
                pie: {}
    
            },
    
            series: [
            	{ //Line
                    type: 'area',
                    name: 'ETH',
    
                    data: info.sums.map(function(e, i) { return [info.dates[i], e] }),
                    marker: {
                        lineWidth: 2,
                        lineColor: Highcharts.getOptions().colors[3],
                        fillColor: 'white'
                    },
                    enableMouseTracking: true,
    
                    color: '#ee06a4',
                    shadow: {
                        color: '#ee06a4',
                        width: 3,
                        offsetX: 0,
                        offsetY: 0
                    }
                }, { // Line 2
                    type: 'spline',
                    name: 'Users',
                    data: info.nums.map(function(e, i) { return [info.dates[i], e] }),
                    color: '#78ee06',
                    enableMouseTracking: true,
                    shadow: {
                        color: '#78ee06',
                        width: 3,
                        offsetX: 0,
                        offsetY: 0
                    },
                    formatter: function () {
                        return this.value;
                    }
                },
                {
                    type: 'pie',
                    name: 'Investment',
                    data: [
                        {
                            name: avg + ' AVG',
                            sliced: true,
                            selected: true,
                            y: avg,
                            color: 'rgba(150,100,50,0.1)' // AVG color
                        }, {
                            name: min + ' MIN',
                            y: min,
                            color: 'rgba(200,122,200,0.7)' // Joe's color
                        },
                        {
                            name: max + ' MAX',
                            y: max,
                            color: 'rgba(200,122,200,1)' // John's color
                        },
                    ],
                    center: [100, 80],
                    size: 100,
                    showInLegend: false,
                    dataLabels: {
                        enabled: false
                    }
                }]
        });
    }

}

function findAddress(address){
	var addr = address.toLowerCase();
	if(!window.investmentInfo)
		return null;

    if(investmentInfo.investors[addr])
    	return addr;

    for(var key in investmentInfo.investors){
    	if(key.indexOf(addr) === 0)
    		return key;
    }

    return null;
}

function updateDividentsTimer(investmentInfo, addr){
    if(investmentInfo)
    	updateDividents(investmentInfo, addr);
    else
		setCalcValues('?', '?', '?', '?', '?');
}

function fmtTime(d){
	return '<span class="date">' + ("0" + d.getDate()).slice(-2) + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" +
    		d.getFullYear() + '</span> <span class="time">' + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + '</span>';
}

function updateDividents(investmentInfo, addr){
    var currentPs = window.multiplier.methods.currentReceiverIndex().call();
    var countsPs = window.multiplier.methods.getDeposits(addr).call();
    var count = '-';

    updateContractInfo();

	var got = fmtEther(investmentInfo.got || 0);
	var gas = fmtEther(investmentInfo.gas || 0);
	var sum = fmtEther(investmentInfo.sum);
	var count_all = (investmentInfo.inv.length);
	var lastPayout = '&mdash;';
	if(investmentInfo.gotTime){
	    let d = new Date(investmentInfo.gotTime);
	    lastPayout = fmtTime(d);
    }

	setCalcValues(count, count_all, sum, got, lastPayout);

	Promise.all([currentPs, countsPs]).then(function(vals){
	    var counts = vals[1];
	    if (counts.idxs.length > 0) {
        	count = +counts.idxs[0] - vals[0];
			setCalcValues(count);
    	}
	});
}

async function updateContractInfo(){
	let stagePs = window.multiplier.methods.stage().call();
	let stageByTimePs = window.multiplier.methods.startTime().call();
	let candidatePs = window.multiplier.methods.getCurrentCandidateForPrize().call();
	let prizeMinDepPs = window.multiplier.methods.getCurrentPrizeMinimalDeposit().call();

	let [stage, startTime, candidate, prizeMinDep] = await Promise.all([stagePs, stageByTimePs, candidatePs, prizeMinDepPs]);
	updateContractInfo1(+stage, candidate, +startTime, candidate.prize, prizeMinDep);
}

function n2(str){
	str = '' + str;
	if(str.length < 2)
		str = '0' + str;
	return str;
}

function fmtEther(val){
	return (val/10**18).toFixed(8).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function fmtAddress(addr){
	return addr.replace(/^(0x.{4}).*(.{4})$/, '$1&hellip;$2');
}

async function updateContractInfo1(stage, candidate, startTime, prize, prizeMinDep){
	var status, start, cand, candTime;
	
	if(!candidate.addr || /^0x0+$/i.test(candidate.addr)){
		cand = ' --- '; candTime = '--:--';
	}else{
		cand = candidate.addr;
		let timeLeft = Math.round(Math.max(candidate.timeMade*1000 + 30*60*1000 - (+new Date() - (adjustTime.correction||0)), 0)/1000);
		if(timeLeft < 0) timeLeft = 0;
		candTime = n2(Math.floor(timeLeft/60)) + ':' + n2(timeLeft%60);
	}

	if(!startTime){
		status = false;
		left = '--:--';
		start = '--:--:--';
	}else{
		status = true;
        start = fmtTime(new Date(startTime*1000));
        var left = Math.round(Math.max(startTime*1000 - (+new Date() - (adjustTime.correction||0)), 0)/1000);
        if(left > 0)
        	status = false;
        left = n2(Math.floor(left/3600)) + ':' + n2(Math.floor((left%3600)/60)) + ':' + n2(left%60);
	}


	console.log(status, start, cand);

	var prize_fmt = fmtEther(prize || 0);

	document.getElementById('histPrizeContainer').style.display = status ? 'none' : 'block';
	document.getElementById('curPrizeInfo').style.display = !status ? 'none' : 'block';
    document.getElementById('curPrizeInfoNoPrize').style.display = status ? 'none' : 'block';

	document.getElementById('startTime').innerHTML = start;
	document.getElementById('startTimeLeft').innerHTML = left;
	document.getElementById('statusPending').style.display = status ? 'none' : 'inline';
	document.getElementById('statusActive').style.display = !status ? 'none' : 'inline';
	document.getElementById('prize').innerHTML = prize_fmt;
	document.getElementById('prizeTo').innerHTML = fmtAddress(cand);
	document.getElementById('prizeIn').innerHTML = candTime;
    document.getElementById('prizeMinDep').innerHTML = fmtEther(prizeMinDep);
}

if(!Number.prototype.toLocaleString){
	Number.prototype.toLocaleString = Number.prototype.toString;
}


function updateHistoricInfo(info){
	var got = Math.round(info.sum/Math.pow(10, 16))/100;
	document.getElementById("info_sum").innerHTML = got.toLocaleString();
	document.getElementById("info_sum_usd").innerHTML = Math.round(got*info.rate).toLocaleString();
	document.getElementById("info_num").innerHTML = (info.num).toLocaleString();

	document.getElementById("histPrize").style.display = info.prizes.length ? 'block' : 'none';
	if(info.prizes.length){
		var prize = info.prizesMap[info.prizes[info.prizes.length-1]];
		
		document.getElementById("histPrizeAddr").innerHTML = fmtAddress(prize.addr || '&mdash;');
		document.getElementById("histPrizeTime").innerHTML = fmtTime(new Date(prize.timeStamp*1000));
		document.getElementById("histPrizeSum").innerHTML = fmtEther(prize.sum);
	}
}


function calcInvestment(resetTime){
	var inp = document.getElementById('inputInvestments');
	var text = inp.value.trim().replace(/,/g, '.');
	if(/^0x[\da-f]*$/i.test(text)){
		//Address
		var addr = findAddress(text);
		var info;
	    if(addr){
	    	info = window.investmentInfo.investors[addr];
	    	localStorage.setItem('address', addr);
			if(text.length < addr.length){
				inp.value = addr;
				createSelection(inp, text.length, addr.length);
			}
		}
		updateDividentsTimer(info, addr);
	}else{
		updateDividentsTimer(null);
	}
	
	
}

function setCalcValues(count, count_all, inv, got, lastPayout){
	if(typeof(count) !== 'undefined')
		document.getElementById('calcDepCountInQueue').innerHTML = count;
	if(typeof(inv) !== 'undefined')
		document.getElementById('calcInvestmentValue').innerHTML = inv;
	if(typeof(got) !== 'undefined')
		document.getElementById('calcDividendsOut').innerHTML = got;
	if(typeof(lastPayout) !== 'undefined')
		document.getElementById('calcLastPayout').innerHTML = lastPayout;
	if(typeof(count_all) !== 'undefined')
		document.getElementById('calcDepCount').innerHTML = count_all;
}

function createSelection(field, start, end) {
    if( field.createTextRange ) {
        var selRange = field.createTextRange();
        selRange.collapse(true);
        selRange.moveStart('character', start);
        selRange.moveEnd('character', end);
        selRange.select();
    } else if( field.setSelectionRange ) {
        field.setSelectionRange(start, end);
    } else if( field.selectionStart ) {
        field.selectionStart = start;
        field.selectionEnd = end;
    }
    field.focus();
}       

function onChangeLang(lang){
	localStorage.setItem('lang', lang);
	return true;
}

function getContractInstance(){
	var web3 = new Web3(new Web3.providers.HttpProvider("https://rinkeby.infura.io/metamask"));
	var abi = JSON.parse('[{"constant":false,"inputs":[{"name":"time","type":"uint256"},{"name":"_gasprice","type":"uint256"}],"name":"setStartTimeAndMaxGasPrice","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_tech","type":"address"},{"name":"_promo","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"constant":true,"inputs":[],"name":"currentQueueSize","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"currentReceiverIndex","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"depositsMade","outputs":[{"name":"stage","type":"int128"},{"name":"count","type":"uint128"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getCurrentCandidateForPrize","outputs":[{"name":"addr","type":"address"},{"name":"prize","type":"uint256"},{"name":"timeMade","type":"uint256"},{"name":"timeLeft","type":"int256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getCurrentPrizeMinimalDeposit","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"idx","type":"uint256"}],"name":"getDeposit","outputs":[{"name":"depositor","type":"address"},{"name":"deposit","type":"uint256"},{"name":"expect","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"depositor","type":"address"}],"name":"getDepositorMultiplier","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"depositor","type":"address"}],"name":"getDeposits","outputs":[{"name":"idxs","type":"uint256[]"},{"name":"deposits","type":"uint128[]"},{"name":"expects","type":"uint128[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"depositor","type":"address"}],"name":"getDepositsCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getQueueLength","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"lastDepositInfo","outputs":[{"name":"index","type":"uint128"},{"name":"time","type":"uint128"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"MAX_IDLE_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"MAX_INVESTMENT","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"MAX_SET_TIME_RANGE","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"maxGasPrice","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"MIN_INVESTMENT_FOR_PRIZE","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"PRIZE_PERCENT","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"prizeAmount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"PROMO_PERCENT","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"stage","outputs":[{"name":"","type":"int256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"startTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"TECH_PERCENT","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}]');
	var address = '0xdf17e8cc5d8020acb11af5178715cce6600d1c98';
	var contractInstance = new web3.eth.Contract(abi, address);
	contractInstance.web3 = web3;

	return contractInstance;
}

function adjustTime(){
	adjustTime.correction = 0;

	var beforeAsk = +new Date();
    fetch('https://cors-anywhere.herokuapp.com/http://worldclockapi.com/api/json/utc/now?_=' + (+new Date())).then(response => response.json()).then(tm => {
    	var time = tm.currentFileTime / 10000 - 11644473600000;
    	var diff = (time-(+new Date() + beforeAsk)/2);
    	console.log("Difference: " + diff);
    	adjustTime.correction = Math.round(diff);
    });
}

function updateInfo(){
    getInfo(window.investmentInfo || window.g_initialInfo).then(function(info){
    	window.investmentInfo = info;

    	updateHistoricInfo(info);

    	drawChart(info);

    	calcInvestment();
    });
}