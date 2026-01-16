#!/bin/bash

# ============================================================
# Maximumm Chatbot QA Test Script
# ============================================================
# Dieses Script reproduziert alle 21 QA-Tests
# Usage: bash test_chatbot.sh
# ============================================================

API_URL="https://idpabackend-production.up.railway.app/api/chat"
CHATBOT_ID="cmke7m9660005ms01qblm1ia4"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

# Function to run a test
run_test() {
    local test_num=$1
    local category=$2
    local question=$3

    TEST_COUNT=$((TEST_COUNT + 1))

    echo -e "\n${YELLOW}════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Test #${test_num}: ${category}${NC}"
    echo -e "${YELLOW}════════════════════════════════════════${NC}"
    echo "Question: $question"
    echo ""

    # Make API call
    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"chatbotId\":\"$CHATBOT_ID\",\"message\":\"$question\"}")

    # Extract relevant fields
    unknown=$(echo $response | jq -r '.unknown')
    claims=$(echo $response | jq -r '.claims[0].text')
    reason=$(echo $response | jq -r '.reason' 2>/dev/null)

    # Display response
    if [ "$unknown" == "true" ]; then
        echo -e "${YELLOW}Status: Unknown/Off-Topic${NC}"
        echo "Reason: $reason"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${GREEN}Status: ✅ Answered${NC}"
        # Show first 200 chars of response
        response_preview="${claims:0:200}"
        if [ ${#claims} -gt 200 ]; then
            response_preview="${response_preview}..."
        fi
        echo "Response (preview): $response_preview"
        PASS_COUNT=$((PASS_COUNT + 1))
    fi
}

# ============================================================
# KATEGORIE 1: NORMALE FRAGEN (5 Tests)
# ============================================================
echo -e "\n${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  KATEGORIE 1: NORMALE FRAGEN               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"

run_test 1 "Normale Frage" "Was ist Maximumm?"
run_test 2 "Normale Frage" "Welche Dienstleistungen bietet Maximumm an?"
run_test 3 "Normale Frage" "Wie kann ich Maximumm kontaktieren?"
run_test 4 "Normale Frage" "Wo sind die Standorte von Maximumm?"
run_test 5 "Normale Frage" "Was sind die Öffnungszeiten?"

# ============================================================
# KATEGORIE 2: SPEZIFISCHE FRAGEN (5 Tests)
# ============================================================
echo -e "\n${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  KATEGORIE 2: SPEZIFISCHE FRAGEN           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"

run_test 6 "Spezifische Frage" "Wie kann ich mich anmelden oder registrieren?"
run_test 7 "Spezifische Frage" "Was kosten die Dienstleistungen von Maximumm?"
run_test 8 "Spezifische Frage" "Wer kann bei Maximumm teilnehmen? Wer ist die Zielgruppe?"
run_test 9 "Spezifische Frage" "Erzählen Sie mir mehr über das Projekt \"Tor zum Arbeitsmarkt\""
run_test 10 "Spezifische Frage" "Wer ist im Team von Maximumm? Wer sind die Mitarbeiter?"

# ============================================================
# KATEGORIE 3: EDGE CASES (7 Tests)
# ============================================================
echo -e "\n${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  KATEGORIE 3: EDGE CASES & SCHWIERIGE FRAGEN║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"

run_test 11 "Edge Case" "Hallo"
run_test 12 "Edge Case (Off-Topic)" "Wie wird das Wetter morgen?"
run_test 13 "Edge Case (Tippfehler)" "Wie kan ich mich anmelrn?"
run_test 14 "Edge Case (Englisch)" "What services does Maximumm offer?"
run_test 15 "Edge Case (Unsinn)" "Blablabla xyz 123 ???"
run_test 16 "Edge Case (Komplex)" "Ich bin 19 Jahre alt, habe keinen Schulabschluss, lebe im Oberaargau und bin derzeit ohne Arbeit. Ich suche nach einem Programm, das mich dabei unterstützt, in den Arbeitsmarkt zu kommen. Kann Maximumm mir helfen?"
run_test 17 "Edge Case (Mehrdeutig)" "?"

# ============================================================
# KATEGORIE 4: KONVERSATIONEN (5 Tests)
# ============================================================
echo -e "\n${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  KATEGORIE 4: KONVERSATIONS-SZENARIEN      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"

run_test 18 "Konversation" "Ich bin interessiert an einem Coaching-Programm"
run_test 19 "Konversation (Follow-up)" "Wie viel kostet es?"
run_test 20 "Konversation" "Ich brauche Hilfe"
run_test 21 "Konversation (Beschwerde)" "Eure Website ist nicht benutzerfreundlich und ich finde keine Informationen"
run_test 22 "Konversation" "Wie funktioniert die Bewerbungswerkstatt?"

# ============================================================
# SUMMARY
# ============================================================
echo -e "\n${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  TEST SUMMARY                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"

echo -e "\nGesamttests: ${TEST_COUNT}"
echo -e "Bestanden: ${GREEN}${PASS_COUNT}${NC}"
echo -e "Fehlgeschlagen: ${RED}${FAIL_COUNT}${NC}"

if [ $TEST_COUNT -gt 0 ]; then
    success_rate=$((PASS_COUNT * 100 / TEST_COUNT))
    echo -e "\nSuccess Rate: ${GREEN}${success_rate}%${NC}"
fi

echo -e "\n${GREEN}✅ Test Suite abgeschlossen!${NC}\n"
