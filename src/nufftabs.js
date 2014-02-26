// variables
var currentTabId; // ID of currently active tab
var maxTabs; // maximum number of tabs allowed per window
var startActive; // time at which active tab started being active
var tabTimes = new Array(); // array with activity times (tab times table)

var debug = true; // debug boolean

function debugLog(string) {
	if (debug) {
		console.log(string);
	}
}

// debug function
function printTimes() {
	//console.log(tabTimes)
	chrome.tabs.query({ }, function(tabs) {
		//debugLog(tabs);
	});
	for (var i=0; i <tabTimes.length; i++) {
		if (tabTimes[i]){
			debugLog(tabTimes[i] + ": " + tabTimes[i].id + ";" + tabTimes[i].lastActive + ";" + tabTimes[i].totalActive);
		}
	}
}

// initialize
function init() {

	// set defaults
	if (localStorage.discardCriterion == undefined) {
		localStorage.discardCriterion = 'oldest';
	}
	if (localStorage.maxTabs == undefined) {
		localStorage.maxTabs = 20; // default
	}
	if (localStorage.showCount == undefined) {
		localStorage.showCount = false;
	}
	
	// set the id of the current tab
	chrome.tabs.query({ lastFocusedWindow: true, active: true }, function (tabs) {
		currentTabId = tabs[0].id;
	});
	
	// set the usage and last active time for each tab if necessary
	chrome.tabs.query({ }, function(tabs){
		for (var i=0; i <tabs.length; i++) {
			createTimes(tabs[i].id);
		}
		//debugLog(tabTimes);
	});
	
	// start time for activation of current tab
	startActive = Date.now()
	
	updateBadge();
}

// add an entry to the tab times table
function createTimes(tabId) {
	tabTimes[tabId] = {id:tabId, totalActive:0, lastActive: Date.now()};
}

// update count on badge (shared across windows)
function updateBadge() {
	if (localStorage.showCount == '1'){
		chrome.browserAction.setBadgeBackgroundColor({ color: [0, 0, 0, 92] });
		chrome.tabs.query({ lastFocusedWindow: true }, function(tabs) {
			chrome.browserAction.setBadgeText({ text: tabs.length.toString()});
		});
	}
	else {
		chrome.browserAction.setBadgeText({ text: ''});
	}
}

// update active times and current ID
function updateTimes() {
	// update total active time for previous tab
	chrome.tabs.get(currentTabId, function(tab){
		if (tab){
			
			// set last active time
			tabTimes[currentTabId].lastActive = Date.now();
			
			// update total active time
			var duration = Date.now() - startActive;
			debugLog('Adding '+(Math.floor(duration/10)/100)+'s to tab '+currentTabId);
			tabTimes[currentTabId].totalActive = tabTimes[currentTabId].totalActive + duration;
		}
		startActive = Date.now();
		printTimes();
	});
	
	// set the ID of the current tab
	chrome.tabs.query({ lastFocusedWindow: true, active: true }, function (tabs) {
		currentTabId = tabs[0].id;
		//debugLog("Current: "+currentTabId);
	});
}

// actions to perform upon adding a tab
function checkTabAdded() {
	
	// check tabs of current window
	chrome.tabs.query({ currentWindow: true }, function(tabs) {
		//printTimes();
		
		//debugLog("num of tabs: " +tabs.length)
		
		// tab removal criterion
		if (tabs.length - localStorage.maxTabs == 1) {
			
			// debugLog(localStorage.discardCriterion);

			var tabId = tabs[0].id;
			switch(localStorage.discardCriterion) {

				case 'oldest': // oldest tab
					for (var i=1; i <tabs.length; i++) {
						// find tab with lowest ID
						if (tabs[i].id < tabId) {
							tabId = tabs[i].id;
						}
					};
					break;
				
				case 'LRU': // tab with lowest lastActive (except new one)
					for (var i=1; i <tabs.length - 1; i++) {
						if (tabTimes[tabs[i].id].lastActive < tabTimes[tabId].lastActive) {
							tabId = tabs[i].id;
						}
					};
					break;

				case 'LFU': // tab with lowest totalActive (except new one)
					for (var i=1; i <tabs.length - 1; i++) {
						if (tabTimes[tabs[i].id].totalActive < tabTimes[tabId].totalActive) {
							tabId = tabs[i].id;
						}
					};
					break;
				
				case 'random': // random tab (except new one)
					tabId = tabs[Math.floor(Math.random() * (tabs.length-1))].id;
					break;
				default:
			}
			
			//debugLog('Chosen: '+tabId)
			chrome.tabs.get(tabId, function(tab){
				debugLog('Removing tab '+tab.id+': '+tab.title+', active time '+(Math.floor(tabTimes[tab.id].totalActive/10)/100)+'s, last active: '+tabTimes[tab.id].lastActive);
				removeTimes(tab.id);
				printTimes();
			});

			// remove tab
			chrome.tabs.remove(tabId, function() {});
			//removeTimes(tabId);
		}
		updateBadge();
	});
}

// remove entry from tab times table
function removeTimes(tabId) {
	delete tabTimes[tabId];
}

chrome.tabs.onActivated.addListener(function(activeInfo){
	debugLog("tab " + activeInfo.tabId + " activated");
	updateTimes();
	updateBadge();
	// debugLog("Window=" + activeInfo.windowId + ", Tab="+activeInfo.tabId);
});

chrome.tabs.onCreated.addListener(function(tab) {
	debugLog("tab " + tab.id + " created");
	createTimes(tab.id);
	updateTimes();
	checkTabAdded(); // contains updateBadge
});

chrome.tabs.onRemoved.addListener(function(tabId) {
	debugLog("tab removed");
	removeTimes(tabId);
	updateTimes();
	updateBadge();
});

chrome.tabs.onDetached.addListener(function(tab) {
	debugLog("tab detached");
	updateBadge();
});

chrome.tabs.onAttached.addListener(function(tab) {
	debugLog("tab attached");
	checkTabAdded(); // contains updateBadge
});

chrome.windows.onFocusChanged.addListener(function(windowId) {
	debugLog("window focus changed");
	updateTimes();
	updateBadge();
});

window.addEventListener("load", init);
