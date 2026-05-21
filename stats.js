// https://docs.google.com/forms/d/e/1FAIpQLSckLaYsMIqbJguPM9RsNaJBtBfMBIbxRK73Jvb1XZ3dd2K8BQ/viewform?usp=pp_url&entry.454342144=guesses&entry.1262069453=numGuesses

const FORM_ID = "1FAIpQLSckLaYsMIqbJguPM9RsNaJBtBfMBIbxRK73Jvb1XZ3dd2K8BQ";
const ENTRY_GUESSES = "entry.454342144";
const ENTRY_NUM_GUESSES = "entry.1262069453";

// https://docs.google.com/spreadsheets/d/1ZwBCqixfV8WUWSoMql1acFahesMpkKcRvX7jGXG4gk4/edit?usp=sharing

const SHEET_ID = "1ZwBCqixfV8WUWSoMql1acFahesMpkKcRvX7jGXG4gk4";
const DATA_PATH = "data.csv";

function getParisDateString(date = new Date()) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Paris",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

function processCharacterData(text) {
    return text
        .trim()
        .split("\n")
        .slice(2)
        .filter((row) => row.trim())
        .filter((row) => {
            const fields = row.split(",");
            return fields.length === 5 && fields.every((field) => field.trim());
        })
        .map((row) => row.split(",")[0].trim());
}

function getSheetSeed(dateString) {
    const [datePart] = dateString.split(" ");
    const [day, month, year] = datePart.split("/");
    return parseInt(`${year}${month}${day}`, 10);
}

function todaysCharName(dateString, characterNames) {
    if (!characterNames.length) {
        return "N/A";
    }

    return characterNames[getSheetSeed(dateString) % characterNames.length];
}

function hasCompletedToday() {
    const todaySeed = getSheetSeed(getParisDateString());
    const savedGame = JSON.parse(localStorage.getItem("imaginedlePlayerData") || "{}")[todaySeed];
    return savedGame && savedGame.win === true;
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

function buildCharacterDifficultyHtml(data, characterNames) {
    const perCharacter = {};

    data.forEach((row) => {
        if (!row[0] || !row[2]) {
            return;
        }

        const characterName = todaysCharName(row[0], characterNames);
        const numGuesses = parseInt(row[2], 10);

        if (!Number.isFinite(numGuesses)) {
            return;
        }

        if (!perCharacter[characterName]) {
            perCharacter[characterName] = { totalGuesses: 0, totalGames: 0 };
        }

        perCharacter[characterName].totalGuesses += numGuesses;
        perCharacter[characterName].totalGames += 1;
    });

    const characterAverages = Object.entries(perCharacter)
        .filter(([, stats]) => stats.totalGames > 0)
        .map(([characterName, stats]) => ({
            characterName,
            averageGuesses: stats.totalGuesses / stats.totalGames,
            totalGames: stats.totalGames
        }));

    if (characterAverages.length === 0) {
        return `<section class="stats-block"><h2>Profs</h2><p>Aucune donnée disponible pour le moment.</p></section>`;
    }

    const easiest = characterAverages.reduce((best, current) => current.averageGuesses < best.averageGuesses ? current : best);
    const hardest = characterAverages.reduce((worst, current) => current.averageGuesses > worst.averageGuesses ? current : worst);

    return `<section class="stats-block"><h2>Profs les plus faciles / difficiles</h2><p>Plus facile: ${easiest.characterName} (${easiest.averageGuesses.toFixed(2)} essais en moyenne sur ${easiest.totalGames} partie${easiest.totalGames > 1 ? "s" : ""})</p><p>Plus difficile: ${hardest.characterName} (${hardest.averageGuesses.toFixed(2)} essais en moyenne sur ${hardest.totalGames} partie${hardest.totalGames > 1 ? "s" : ""})</p></section>`;
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
    Promise.all([
        fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=tsv`).then((response) => response.text()),
        fetch(DATA_PATH).then((response) => response.text())
    ]).then(([csv, charactersCsv]) => {
        const lines = csv.split('\n');
        const data = lines.slice(1).map((line) => line.split('\t'));
        const characterNames = processCharacterData(charactersCsv);
        const today = getParisDateString();
        const todayData = data.filter((row) => row[0] && row[0].split(" ")[0] === today);
        const showCharacterDifficulty = hasCompletedToday();

        div.innerHTML = "";
        div.insertAdjacentHTML("beforeend", buildStatsHtml(data, "Stats globales"));
        div.insertAdjacentHTML("beforeend", buildStatsHtml(todayData, "Stats d'aujourd'hui"));
        if (showCharacterDifficulty) {
            div.insertAdjacentHTML("beforeend", buildCharacterDifficultyHtml(data, characterNames));
        }
    });
}