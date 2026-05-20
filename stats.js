// https://docs.google.com/forms/d/e/1FAIpQLSckLaYsMIqbJguPM9RsNaJBtBfMBIbxRK73Jvb1XZ3dd2K8BQ/viewform?usp=pp_url&entry.454342144=guesses&entry.1262069453=numGuesses

const FORM_ID = "1FAIpQLSckLaYsMIqbJguPM9RsNaJBtBfMBIbxRK73Jvb1XZ3dd2K8BQ";
const ENTRY_GUESSES = "entry.454342144";
const ENTRY_NUM_GUESSES = "entry.1262069453";

// https://docs.google.com/spreadsheets/d/1ZwBCqixfV8WUWSoMql1acFahesMpkKcRvX7jGXG4gk4/edit?usp=sharing

const SHEET_ID = "1ZwBCqixfV8WUWSoMql1acFahesMpkKcRvX7jGXG4gk4";

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
            // Show most used first guess (guess is a json list)
            // Also show average number of guesses
            const firstGuessCounts = {};
            let totalGuesses = 0;
            let totalGames = 0;
            console.log(data);
            data.forEach((row) => {
                const parsedGuesses = JSON.parse(row[1]);
                const numGuesses = parseInt(row[2]);
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
            div.innerHTML = `Plus fréquent 1er guess: ${mostUsedGuess} (${mostUsedCount} fois)<br>Nombre d'essais moyen: ${averageGuesses.toFixed(2)}<br>Total de parties jouées: ${totalGames}`;
        });
}