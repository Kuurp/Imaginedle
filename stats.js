// https://docs.google.com/forms/d/e/1FAIpQLSckLaYsMIqbJguPM9RsNaJBtBfMBIbxRK73Jvb1XZ3dd2K8BQ/viewform?usp=pp_url&entry.454342144=guesses&entry.1262069453=numGuesses

const FORM_ID = "1FAIpQLSckLaYsMIqbJguPM9RsNaJBtBfMBIbxRK73Jvb1XZ3dd2K8BQ";
const ENTRY_GUESSES = "entry.454342144";
const ENTRY_NUM_GUESSES = "entry.1262069453";

// https://docs.google.com/spreadsheets/d/1ZwBCqixfV8WUWSoMql1acFahesMpkKcRvX7jGXG4gk4/edit?usp=sharing

const SHEET_ID = "1ZwBCqixfV8WUWSoMql1acFahesMpkKcRvX7jGXG4gk4";

function getParisDateString(date = new Date()) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Paris",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

function buildStatsHtml(data, title) {
    const firstGuessCounts = {};
    let totalGuesses = 0;
    let totalGames = 0;

    data.forEach((row) => {
        if (!row[1] || !row[2]) {
            return;
        }

        const parsedGuesses = JSON.parse(row[1]);
        const numGuesses = parseInt(row[2], 10);

        if (parsedGuesses.length > 0) {
            const firstGuess = parsedGuesses[0];
            firstGuessCounts[firstGuess] = (firstGuessCounts[firstGuess] || 0) + 1;
        }

        totalGuesses += numGuesses;
        totalGames += 1;
    });

    const mostUsedGuess = Object.keys(firstGuessCounts).length > 0
        ? Object.keys(firstGuessCounts).reduce((a, b) => firstGuessCounts[a] > firstGuessCounts[b] ? a : b)
        : "N/A";
    const averageGuesses = totalGames > 0 ? totalGuesses / totalGames : 0;
    const mostUsedCount = firstGuessCounts[mostUsedGuess] || 0;

    return `<section class="stats-block"><h2>${title}</h2><p>Plus fréquent 1er guess: ${mostUsedGuess} (${mostUsedCount} fois)</p><p>Nombre d'essais moyen: ${averageGuesses.toFixed(2)}</p><p>Total de parties jouées: ${totalGames}</p></section>`;
}

function sendStats(guesses, numGuesses) {
    const formData = new FormData();
    formData.append(ENTRY_GUESSES, guesses);
    formData.append(ENTRY_NUM_GUESSES, numGuesses);
    fetch(`https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`, {
        method: "POST",
        mode: "no-cors",
        body: formData
    }).catch((error) => {
        console.error("Error sending stats:", error);
    });
}

function showStats(div) {
    fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=tsv`)
        .then((response) => response.text())
        .then((csv) => {
            const lines = csv.split('\n');
            const data = lines.slice(1).map(line => line.split('\t'));
            const today = getParisDateString();
            const todayData = data.filter((row) => row[0] && row[0].split(" ")[0] === today);

            div.innerHTML = "";
            div.insertAdjacentHTML("beforeend", buildStatsHtml(data, "Stats globales"));
            div.insertAdjacentHTML("beforeend", buildStatsHtml(todayData, "Stats d'aujourd'hui"));
        });
}