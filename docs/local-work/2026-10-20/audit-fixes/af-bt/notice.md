# AF-BT: NOTICE.md fragment (held for PR H)

For AF-INT. Applied in PR H, the first PR after true-credits merges (AUDIT-FIXES-PLAN.md section 2). Checked against https://netbible.com/copyright/ on 21 October 2026 (evidence record `net-copyright` in `docs/evidence/af-bt-2026-10-21.json` on branch `af-bt`): the page does not contain the sentence "To see the NET Bible® study tool go to https://netbible.org" that line 85 attributes to it, and its acknowledgment includes `http://netbible.com`.

## Replace

NOTICE.md line 85 (at `2aabdcc`), the paragraph under "## NET Bible":

> The NET text and notes are never stored in this repository, in the build or in the service worker. The reader asks the publisher's own web service (https://labs.bible.org/api_web_service) for one chapter at a time while someone reads the NET, keeps at most two chapters in memory, and shows "(NET)" linked to netbible.org with the copyright line and the sentence "To see the NET Bible® study tool go to https://netbible.org", as https://netbible.com/copyright/ asks of free apps. The permissions cover the text only ("without the NET Bible notes"), so the app never shows the translators' notes: at Study a button links the selected verse to its notes on netbible.org. Other uses need permission from Biblical Studies Press.

## With

> The NET text and notes are never stored in this repository, in the build or in the service worker. The reader asks the publisher's own web service (https://labs.bible.org/api_web_service) for one chapter at a time while someone reads the NET, keeps at most two chapters in memory, and under every NET chapter shows "(NET)", with NET linked to netbible.org, and the acknowledgment https://netbible.com/copyright/ asks of free apps, word for word: "Scripture quoted by permission. Quotations designated (NET) are from the NET Bible® copyright ©1996, 2019 by Biblical Studies Press, L.L.C. http://netbible.com All rights reserved." The permissions cover the text only ("without the NET Bible notes"), so the app never shows the translators' notes: at Study a button links the selected verse to its notes on netbible.org. Other uses need permission from Biblical Studies Press.

## Optional, same finding (B12)

NOTICE.md line 11, the BSB row, could name the translators as the reader now does:

> | Berean Standard Bible (English), by the Berean Bible Translation Committee (2016; public domain since 30 April 2023) | berean.bible, via scrollmapper/bible_databases | Public domain |

Checks for AF-INT: the U+2014 scan and rule 3's credit-phrase scan over the new paragraph (0 hits each, as written here).
