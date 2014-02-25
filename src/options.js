function init() {
	var maxTabs = localStorage.maxTabs;
	var discardCriterion = localStorage.discardCriterion;
	var showCount = localStorage.showCount;
	
	if (!maxTabs && !discardCriterion && !showCount) {
		return;
	}

	var selector = document.getElementById("maxTabs");
	for (var i = 0; i < selector.children.length; i++) {
		var child = selector.children[i];
		if (child.value == maxTabs) {
			child.selected = "true";
		break;
		}
	}

	var selector = document.getElementById("discardCriterion");
	for (var i = 0; i < selector.children.length; i++) {
		var child = selector.children[i];
		if (child.value == discardCriterion) {
			child.selected = "true";
		break;
		}
	}

	var selector = document.getElementById("showCount");
	for (var i = 0; i < selector.children.length; i++) {
		var child = selector.children[i];
		if (child.value == showCount) {
			child.selected = "true";
		break;
		}
	}
}

function saveMe() {
	localStorage.maxTabs = document.getElementById("maxTabs").value;
	localStorage.discardCriterion = document.getElementById("discardCriterion").value;
	localStorage.showCount = document.getElementById("showCount").value;

	document.getElementById('messages').innerHTML = "Options saved.";
	setTimeout(function() {
		document.getElementById('messages').innerHTML = "";
	}, 1500);
}

function closeMe() {
	window.close();
}

function saveClose() {
	localStorage.maxTabs = document.getElementById("maxTabs").value;
	localStorage.discardCriterion = document.getElementById("discardCriterion").value;
	localStorage.showCount = document.getElementById("showCount").value;

	document.getElementById('messages').innerHTML = "Options saved.";
	setTimeout(function() {
		window.close();
	}, 1000);
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('saveButton').addEventListener('click', saveMe);
});

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('closeButton').addEventListener('click', closeMe);
});

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('saveCloseButton').addEventListener('click', saveClose);
});

window.addEventListener("load", init);
