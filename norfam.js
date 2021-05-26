var entropyData = {};
var searchResult = {
    "column-1": {
        "version": 0,
        "records": []
    },
    "column-2": {
        "version": 0,
        "records": []
    },
};
var activeColumn = "column-1";

const domainAddress = "https://nordiskfamiljebok.dh.gu.se/api";
const backgroundColors = ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2"];

const templateWordSim = `
    <table class="table table-sm table-neighbors">
        <thead class="thead-light">
            <tr>
                <th colspan="2"></th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>
`;

const templateResultItem = `
    <div>
        <div class="summary mb-4"></div>
    </div>
`;

const templateEmptyResult = `
    <div>Sökfrågan returnerade inte några poster.</div>
`;

const templateRecord = `
    <h1 class="heading"></h1>
    <div class="body-text mb-4"></div>
`;

function toggleVisibility(column, display, hide) {
    const visiblePanel = document.querySelector(`#${column} .${display}`)
    const hiddenPanel = document.querySelector(`#${column} .${hide}`)
    if (visiblePanel) {
        visiblePanel.classList.add("d-flex");
        visiblePanel.classList.remove("d-none");
    }
    if (hiddenPanel) {
        hiddenPanel.classList.add("d-none");
        hiddenPanel.classList.remove("d-flex");
    }
}

function abbreviate(txt) {
    if (txt.length > 350) {
        return txt.substr(0, 350) + "...";
    } else {
        return txt;
    }
}

function markSupplement(txt, suppl, bold) {
    const marker1 = (bold) ? "<b>&#8984;</b> " : "&#8984; ";
    const marker2 = (bold) ? "<b>&#10003;</b> " : "&#10003; ";
    if (suppl == 1) {
        return marker1 + txt;
    } else if (suppl > 1) {
        return marker2 + txt;
    } else {
        return txt;
    }
}

function trimLineBreaks(txt) {
    return txt.replace(/(<br>\s*){3,}/, "<br><br>");
}

function entropy(c, n) {
    const probs = [c / n, 1 - c / n];
    return -probs.reduce((acc, x) => acc + x * Math.log2(x), 0);
}

function idf(c, n) {
    return Math.log2(n / c)
}

function populateIDFChart(terms) {
    entropyData = {
        labels: terms.map(term => term.term.term_term),
        datasets: [
            {
                backgroundColor: terms.map((term, index) => backgroundColors[index % 5]),
                data: terms.map(term => idf(term.term.term_df, 100000))
            }
        ]
    };
    var ctx = document.querySelector(`#${activeColumn} .chart-idf`).getContext('2d');
    var myBarChart = new Chart(ctx, {
        type: 'bar',
        data: entropyData,
        options: {
            legend: { display: false },
            responsive: true,
            scales: {
                yAxes: [{
                    ticks: {
                        min: 0,
                        max: Math.ceil(Math.max(...entropyData.datasets[0].data))
                    }
                }]
            }
        }
    });
}

function populateNeighbors(q) {
    fetch(`${domainAddress}/api/termsim/?q=${q}`)
        .then(resp => resp.json())
        .then(terms => {
            const parent = document.querySelector(`#${activeColumn} #search-terms > .card-body`);
            parent.innerHTML = "";
            for (let term of terms) {
                var template = document.createElement("template");
                template.innerHTML = templateWordSim;
                var caption = template.content.querySelector("table th");
                caption.textContent = term.term_term;
                var tbody = template.content.querySelector("table > tbody");
                for (var neighbor of term.neighbors) {
                    var row = tbody.insertRow(-1);
                    var cellTerm = row.insertCell(-1);
                    var cellSim = row.insertCell(-1);
                    cellTerm.textContent = neighbor.term.term_term;
                    cellSim.textContent = neighbor.similarity.toFixed(4);
                }
                parent.appendChild(template.content);
            }
        });
}


function populateNamedEntities(id) {
    const categories = {
        "PER" : "Personer",
        "LOC" : "Platser",
        "TME" : "Tidsangivelser",
        "ORG" : "Organisationer"
    };
    fetch(`${domainAddress}/api/entities/?q=${id}`)
        .then(resp => resp.json())
        .then(terms => {
            const parent = document.querySelector(`#${activeColumn} #named-entities > .card-body`);
            parent.innerHTML = "";
            for (let category in categories) {
                const selection = terms.filter(term => term.ent_type == category);
                if (selection.length > 0) {
                    const template = document.createElement("template");
                    template.innerHTML = templateWordSim;
                    const caption = template.content.querySelector("table th");
                    caption.textContent = categories[category];
                    const tbody = template.content.querySelector("table > tbody");
                    for (let entity of selection) {
                        const row = tbody.insertRow(-1);
                        const cellTerm = row.insertCell(-1);
                        cellTerm.textContent = entity.ent_name;
                    }
                    parent.appendChild(template.content);
                }
            }
        });
}

function displayRecord(id, version, column) {
    toggleVisibility(column, "panel-entities", "panel-terms");
    document.body.style.cursor = "default";
    document.querySelector(`#${column} .display-result`).classList.toggle("d-none");
    fetch(`${domainAddress}/api/documents/${id}/?v=${version}`)
        .then(resp => resp.json())
        .then(record => {
            const parent = document.querySelector(`#${column} #search-result > .card-body`);
            var template = document.createElement("template");
            template.innerHTML = templateRecord;
            template.content.querySelector(".heading").innerHTML = markSupplement(record.doc_keyword, record.doc_suppl, false);
            template.content.querySelector(".body-text").innerHTML = trimLineBreaks(record.doc_text);
            parent.innerHTML = template.innerHTML;
            var scanned = (version == 1) ? scanned_1 : scanned_2;
            var keyword = record.doc_keyword;
            if (record.doc_suppl == 1) keyword + "@";
            if (keyword in scanned) {
                parent.innerHTML += '<div><strong>Faksimiler</strong></div>';
                for (let src of scanned[keyword]) {
                    parent.innerHTML += '<div><img src="http://runeberg.org/img' + src + '"></div>';
                }
            }
        });
    //populateNamedEntities(id);
}

function displayEmptyResult() {
    const parent = document.querySelector(`#${activeColumn} #search-result > .card-body`);
    parent.innerHTML = templateEmptyResult;
}

function displayResult() {
    toggleVisibility(activeColumn, "panel-terms", "panel-entities");
    const parent = document.querySelector(`#${activeColumn} #search-result > .card-body`);
    parent.innerHTML = "";
    for (let record of searchResult[activeColumn].records) {
        const template = document.createElement("template");
        template.innerHTML = templateResultItem;
        template.content.querySelector(".summary").innerHTML = markSupplement(record.doc_abstr, record.doc_suppl, true);
        template.content.querySelector(".summary").addEventListener("click", displayRecord.bind(this, record.doc_id, searchResult[activeColumn].version, activeColumn));
        parent.appendChild(template.content);
    }
}

function search() {
    const query = document.querySelector(`#${activeColumn} .txt-search`).value;
    const versionSelector = document.querySelector(`#${activeColumn} .version-number`);
    const version = versionSelector.options[versionSelector.selectedIndex].value;
    const searchModeSelector = document.querySelector(`#${activeColumn} .match-level`);
    const searchMode = searchModeSelector.options[searchModeSelector.selectedIndex].value;
    const url = `${domainAddress}/api/query/?q=${query}&v=${version}&m=${searchMode}`;
    document.body.style.cursor = "wait";
    fetch(url)
        .then(resp => resp.json())
        .then(result => {
            searchResult[activeColumn].records = result;
            searchResult[activeColumn].version = version;
            if (result.length > 0) {
                displayResult();
                populateNeighbors(query);
                populateIDFChart(result[0].doc_terms);
            } else {
                displayEmptyResult();
            }
            document.body.style.cursor = "default";
        });
}


window.onload = function() {
    $(".btn-search").on("click", function() {
        activeColumn = $(this).data("column");
        search();
    });
    $(".txt-search").on("keypress", function(e) {
        activeColumn = $(this).data("column");
        if (e.keyCode == 13) {
            e.preventDefault();
            search();
        }
    });
    $(".display-result").on("click", function() {
        activeColumn = $(this).data("column");
        $(this).toggleClass("d-none");
        displayResult();
    });
    $('input[name=columns]').on("change", function() {
        $("#column-2").toggleClass("d-none");
    });
}
