function getInfo(initialInfo){
	var rate = fetch("https://api.coinmarketcap.com/v1/ticker/ethereum/")
		.then(function(response){
			return response.json();
		});
	var defLastBlock = 0;
	if(!initialInfo)
		initialInfo = {sum: 0, timesum: 0, num: 0, investors: {}, dates: [], nums: [], sums: [], min: -1, max: 0};

	var jsonInternalPromise = fetch("https://api.etherscan.io/api?module=account&action=txlistinternal&address=0x89E88661f0582f0f0a07B63D33ba8EDD3E88E6e5&startblock=" + ((initialInfo.lastBlockInner || initialInfo.lastBlock || defLastBlock) + 1) + "&endblock=99999999&sort=asc&apikey=YourApiKeyToken")
		.then(function(response){
			return response.json();
		});

	return fetch("https://api.etherscan.io/api?module=account&action=txlist&address=0x89E88661f0582f0f0a07B63D33ba8EDD3E88E6e5&startblock=" + ((initialInfo.lastBlock || defLastBlock) + 1) + "&endblock=99999999&sort=asc&apikey=YourApiKeyToken")
		.then(function(response){
			return response.json();
		}).then(function(json){
			var info = json.result.reduce(function(info, tr){
				var val = +tr.value;
				if(!info.firstBlock){
					info.firstBlock = +tr.blockNumber;
					info.firstTime = +tr.timeStamp;
				}
				info.lastBlock = +tr.blockNumber;
				info.lastTime = +tr.timeStamp;

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
				
				if(val){
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
				}
				return info;
			}, initialInfo);

			info.avg = info.sum/info.num;

			return rate.then(function(ratejson){
				info.rate = +ratejson[0].price_usd;
				info.sum_usd = info.sum/Math.pow(10, 18) * info.rate;

				return jsonInternalPromise.then(function(json){
					info = json.result.reduce(function(info, tr){
						if(!(+tr.isError)){
							var inv = info.investors[tr.to];
							if(inv){
								inv.got = (inv.got || 0) + (+tr.value);
								inv.gotTime = tr.timeStamp*1000;
							}
						    info.got = (info.got || 0) + (+tr.value);
						}
						info.lastBlockInner = +tr.blockNumber;
						info.lastTimeInner = +tr.timeStamp;
						return info;
					}, info);
					return info;
				}, function(e){
					console.log('Error fetching internal transactions: ' + e);
					return info;
				});
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

function updateDividents(investmentInfo, addr){
    var currentPs = window.multiplier.methods.currentReceiverIndex().call();
    var countsPs = window.multiplier.methods.getDeposits(addr).call();
    var count = '-';

	var got = ((investmentInfo.got || 0)/Math.pow(10,18)).toFixed(8).replace(/(\.[^0]*)0+$/, '$1');
	var gas = ((investmentInfo.gas || 0)/Math.pow(10,18)).toFixed(8);
	var sum = (investmentInfo.sum/Math.pow(10, 18)).toFixed(8).replace(/(\.[^0]*)0+$/, '$1');
	var count_all = (investmentInfo.inv.length);
	var lastPayout = '&mdash;';
	if(investmentInfo.gotTime){
	    let d = new Date(investmentInfo.gotTime);
	    lastPayout = ("0" + d.getDate()).slice(-2) + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" +
    		d.getFullYear() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
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

function calcInvestment(resetTime){
	if(!updateDividentsTimer.startTime)
		updateDividentsTimer.startTime = +new Date();

	var inp = document.getElementById('inputInvestments');
	var text = inp.value.trim().replace(/,/g, '.');
	if(/^0x[\da-f]*$/i.test(text)){
		updateDividentsTimer.timeDiff = Math.max(window.investmentInfo.last_time - (+new Date()), 0);
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
	var web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/metamask"));
	var abi = JSON.parse('[{"constant":true,"inputs":[],"name":"MULTIPLIER","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"currentReceiverIndex","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"depositor","type":"address"}],"name":"getDeposits","outputs":[{"name":"idxs","type":"uint256[]"},{"name":"deposits","type":"uint128[]"},{"name":"expects","type":"uint128[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"idx","type":"uint256"}],"name":"getDeposit","outputs":[{"name":"depositor","type":"address"},{"name":"deposit","type":"uint256"},{"name":"expect","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getQueueLength","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"PROMO_PERCENT","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"depositor","type":"address"}],"name":"getDepositsCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"}]');
	var address = '0x89E88661f0582f0f0a07B63D33ba8EDD3E88E6e5';
	var contractInstance = new web3.eth.Contract(abi, address);

	return contractInstance;
}