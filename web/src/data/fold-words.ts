// Word lists for fold.ts, checked against the BSB, KJV and ASV text: every
// form was read in its verses, and forms that mean something else somewhere
// were left out ("pass over" is not always Passover, "every one" is not
// always everyone, "plat" is a plot of ground but "plot" is often a scheme).
// Groups are separated by "|"; the first form in each is the one search uses.

/** Spellings: British ("honour"), older ("shew"), and the King James forms of
 *  names ("Elias" for Elijah, "Esaias" for Isaiah). */
export const SPELLINGS =
  'perez pharez phares parez|nebuchadnezzar nebuchadrezzar|kiriath kirjath|kiriathaim kirjathaim|paddan padan|' +
  'nethanel nethaneel|bezalel bezaleel|mahalalel mahalaleel maleleel|hadadezer hadarezer|pashhur pashur|' +
  'shecaniah shechaniah|ladan laadan|topheth tophet|uriah urijah urias|micaiah michaiah|oholah aholah|' +
  'oholiab aholiab|oholibah aholibah|oholibamah aholibamah|basemath bashemath basmath|ephrathah ephratah|' +
  'hodiah hodijah|hasshub hashub|hathach hatach|ishmaelite ishmeelite|ishmaelites ishmeelites|kenizzite kenezite|' +
  'korahites korhites korathites|maacathite maachathite|maacathites maachathites maachathi|meshezabel meshezabeel|' +
  'acsah achsah|tattenai tatnai|zechariah zacharias zachariah|hanamel hanameel|hananel hananeel|' +
  'chinnereth chinneroth cinneroth|michmash michmas|azarel azareel azarael|hagrites hagarites hagarenes|' +
  'hagrite hagerite|ivvah ivah|jalam jaalam|imlah imla|kebar chebar|chislev chisleu|shebat sebat|ziv zif|' +
  'maskil maschil|miktam michtam|nazirite nazarite|nazirites nazarites|ashkelon askelon|aijalon ajalon|' +
  'ahijah ahiah|abijah abiah abia|ai hai|uz huz|shimei shimhi shimi|malchijah melchiah|ashkenaz ashchenaz|' +
  'arpad arphad|ashtaroth astaroth|jazer jaazer|gezer gazer|geba gaba|meshech mesech|mica micha|micah michah|' +
  'rabbah rabbath|terah tarah thara|tekoa tekoah|temah thamah tamah|taanach tanach|zedekiah zidkijah|' +
  'hezekiah ezekias hizkijah|joshua jehoshua|hoshea oshea|nahshon naasson naashon|sabteca sabtecha|senir shenir|' +
  'sharezer sherezer|sibmah shibmah|shimri simri|shelah salah|sharon saron|shemariah shamariah|jeshurun jesurun|' +
  'kishon kison|pishon pison|rameses raamses|meunim mehunim mehunims|arphaxad arpachshad|waheb vaheb|ocran ochran|' +
  'shechem sychem sichem|zorah zareah zoreah|zorathites zareathites|zarethan zaretan zarthan zartanah|' +
  'isshiah jesiah ishiah|imnah jimna jimnah|iphtah jiphthah jiphtah|ithlah jethlah|shibah shebah|hegai hege|' +
  'molech moloch|nebaioth nebajoth|sibbecai sibbechai|hizki hezeki|semein semei|soco shocho shoco socho|' +
  'socoh shochoh sochoh|phicol phichol|tiglath tilgath|zebulunite zebulonite|abanah abana|ebez abez|acco accho|' +
  'ahuzzam ahuzam|aiah ajah|allammelech alammelech|alvah aliah|alvan alian|alemeth allemeth alameth|' +
  'ammihud ammihur|anathothite antothite anethothite anetothite|anthothijah antothijah|arba arbah|' +
  'arubboth aruboth|asaiah asahiah|asarel asareel|asarelah asharelah|asriel ashriel|ashhur ashur|avva ava|' +
  'ezem azem|azzur azur|berechiah barachiah barachias berachiah|becorath bechorath|bela belah|beracah berachah|' +
  'beerothite berothite|birzaith birzavith|biziothiah bizjothjah|kamon camon|carkas carcas|kareah careah|' +
  'calcol chalcol|harashim charashim|cozeba chozeba|cun chun|cushan chushan|conaniah cononiah|koz coz|' +
  'daberath dabareh|dabbesheth dabbasheth|delaiah dalaiah|deker dekar|diblah diblath|dilan dilean|' +
  'dodavahu dodavah|abronah ebronah|eliada eliadah|eliehoenai elihoenai|eliphelet eliphalet|eliphelehu elipheleh|' +
  'elmadam elmodam|elpelet elpalet|eshan eshean|eshtaolites eshtaulites|geshem gashmu|' +
  'ginnethon ginnetho ginnethoi|gishpa gispa|goah goath|hobaiah habaiah|habazziniah habaziniah|hacaliah hachaliah|' +
  'hagabah hagaba|hagri haggeri|hallohesh halohesh|hammolecheth hammoleketh|hammuel hamuel|hanniel haniel|' +
  'hereth hareth|hassenuah hasenuah senuah|hashabneiah hashabniah|hasupha hashupha|hazzelelponi hazelelponi|' +
  'hazazon hazezon|heled heleb|igal igeal|iye ije|iphdeiah iphedeiah|ishhod ishod|ishvah ishuah isuah|' +
  'ishvi ishuai ishui isui|ishmaiah ismaiah|ishpah ispah|izhar izehar|izharites izeharites|jaala jaalah|' +
  'jaasu jaasau|jacan jachan|jahzeiah jahaziah|jaanai janai|janoah janohah|jaareshiah jaresiah|jashar jasher|' +
  'jaasiel jasiel|jeatherai jeaterai|jeberekiah jeberechiah|jekamiah jecamiah|jecoliah jechiliah jecholiah|' +
  'jeconiah jechoniah jechonias|iezer jeezer|jehallelel jehaleleel jehalelel|jehezkel jehezekel|' +
  'jehoaddah jehoadah|jehoaddan jehoaddin|jehiel jehuel|jemimah jemima|jeshaiah jesaiah|jesarelah jesharelah|' +
  'izziah jeziah|izliah jezliah|ibsam jibsam|jorkeam jorkoam|jozabad josabad|joshibiah josibiah|jotbathah jotbath|' +
  'jotham joatham jothan|juttah jutah|karka karkaa|keziah kezia|chitlish kithlish|lakkum lakum|lappidoth lapidoth|' +
  'lasharon lassharon|lebanah lebana|maasai maasiai|machbanai machbannai|machbenah machbena|mahlah mahalah|' +
  'mahli mahali|mattattah mattathah|megiddo megiddon|mehetabel mehetabeel|meconah mekonah|meribath meriboth|' +
  'mezobaite mesobaite|methusael methushael|mijamin miamin|michmethath michmethah|mirmah mirma|mishal misheal|' +
  'mithkah mithcah|moreshite morashtite morasthite|moserah mosera|naarah naarath|nacon nachon|nahalal nahallal|' +
  'naphish nephish|nephushesim nephishesim|nephusim nephisim|nebai nobai|peullethai peulthai|pallu phallu|' +
  'palti phalti|paltiel phaltiel|parosh pharosh|paseah phaseah|purah phurah|puvah phuvah pua|phygelus phygellus|' +
  'pilha pileha|pispa pispah|puthites puhites|racal rachal|reuel raguel|rekem rakem|reaiah reaia|recah rechah|' +
  'rimmon remmon|rizia rezia|sachar sacar|salecah salcah salchah|shalmai salmai shamlai|shaphir saphir|' +
  'sarsekim sarsechim|secu sechu|syene seveneh|sachia shachia|shagee shage|shahazumah shahazimah|shemer shamer|' +
  'shepher shapher|shaaraim sharaim|sebam shebam|shenazzar shenazar|shephatiah shephathiah|shepho shephi|' +
  'shikkeron shicron|shimea shimma|shulammite shulamite|sismai sisamai|sucathites suchathites|tabrimmon tabrimon|' +
  'tahchemonite tachmonite|tahpanhes tehaphnehes tahapanes|tahash thahash|telassar thelasar|timnah thimnathah|' +
  'vaizatha vajezatha|zaccur zacchur|zecher zacher|zaphenath zaphnath|zerah zarah zara|zered zared|zereth zareth|' +
  'zattu zatthu|zaavan zavan|zebidah zebudah|zepho zephi|zeredah zereda zeredathah|zererah zererath|' +
  'zillethai zilthai|sithri zithri|nahum naum|menna menan|naggai nagge|jannai janna|bozkath boscath|hotham hothan|' +
  'eder ader edar|caesar cesar cæsar|caesarea cæsarea cesarea|alphaeus alphæus alpheus|' +
  'thaddaeus thaddæus thaddeus|bartimaeus bartimæus bartimeus|timaeus timæus timeus|hymenaeus hymenæus hymeneus|' +
  'zacchaeus zacchæus zaccheus|ituraea ituræa iturea|colossae colossæ colosse|praetorium prætorium pretorium|' +
  'judea judæa|idumea idumæa|arimathea arimathæa|galilean galilæan|galileans galilæans|chaldeans chaldæans|' +
  'tryphena tryphæna|cenchrea cenchreæ|epenetus epænetus|aenon ænon|berea beroea|nicolas nicolaüs|jairus jaïrus|' +
  'elijah elias eliah|isaiah esaias|elisha eliseus|noah noe|hosea osee|jeremiah jeremy jeremias|korah core|' +
  'messiah messias|timothy timotheus|luke lucas|hagar agar|sinai sina|canaan chanaan|hezron esrom|uzziah ozias|' +
  'serug saruch|reu ragau|peleg phalec|methuselah mathusala|shem sem|nahor nachor|zarephath sarepta|' +
  'nineveh nineve|ahaz achaz|jehoshaphat josaphat|manasseh manasses|josiah josias|boaz booz|amminadab aminadab|' +
  'rahab rachab|tamar thamar|rehoboam roboam|zadok sadoc|shealtiel salathiel|zerubbabel zorobabel|midian madian|' +
  'hamor emmor|haran charran|gideon gedeon|jephthah jephthae|melchizedek melchisedec|zebulun zabulon|' +
  'naphtali nephthalim nepthalim|asher aser|ramah rama|rachel rahel|balak balac|beor bosor|sodom sodoma|' +
  'gomorrah gomorrha|sarah sara|elizabeth elisabeth|immanuel emmanuel|akeldama aceldama|kidron cedron|' +
  'hallelujah alleluia|clopas cleophas|tyre tyrus|sidon zidon|sidonians zidonians|beelzebul beelzebub|enosh enos|' +
  'aeneas eneas|phoebe phebe|phoenicia phenicia|syrophoenician syrophenician|pergamum pergamos|malta melita|' +
  'cauda clauda|cos coos|samothrace samothracia|miletus miletum|euodia euodias|ampliatus amplias|urbanus urbane|' +
  'nympha nymphas|barsabbas barsabas|rephan remphan|quirinius cyrenius|greece grecia|abigail abigal|honor honour|' +
  'honorable honourable|honored honoured|honorest honourest|honoreth honoureth|honors honours|dishonor dishonour|' +
  'dishonorest dishonourest|dishonoreth dishonoureth|labor labour|labored laboured|laborer labourer|' +
  'laborers labourers|laboreth laboureth|laboring labouring|labors labours|favor favour|favorable favourable|' +
  'favored favoured|favorest favourest|favoreth favoureth|neighbor neighbour|neighbors neighbours|savior saviour|' +
  'savor savour|savory savoury|valor valour|armor armour|armorbearer armourbearer|armory armoury|' +
  'behavior behaviour|clamor clamour|color colour|colored coloured|colors colours|endeavor endeavour|' +
  'endeavored endeavoured|endeavoring endeavouring|endeavors endeavours|odor odour|odors odours|parlor parlour|' +
  'parlors parlours|rigor rigour|rumor rumour|rumors rumours|succor succour|succored succoured|vapor vapour|' +
  'vapors vapours|counseled counselled|counselor counsellor|counselors counsellors|marveled marvelled|' +
  'marveling marvelling|marvelous marvellous|traveled travelled|traveler traveller|travelers travellers|' +
  'traveling travelling|quarreling quarrelling|reveling revelling|leveled levelled|appareled apparelled|' +
  'worshiped worshipped|worshiping worshipping|worshiper worshipper|worshipers worshippers|fulfill fulfil|' +
  'fulfillment fulfilment|fullness fulness|skillful skilful|skillfully skilfully|willful wilful|' +
  'willfully wilfully|distill distil|enroll enrol|enrollment enrolment|tranquility tranquillity|woolen woollen|' +
  'defense defence|offense offence|pretense pretence|license licence|recompense recompence|practice practise|' +
  'practiced practised|scepter sceptre|sepulcher sepulchre|sepulchers sepulchres|miter mitre|plow plough|' +
  'show shew|showed shewed|showedst shewedst|showest shewest|showeth sheweth|showing shewing|showbread shewbread|' +
  'steadfast stedfast|steadfastly stedfastly|steadfastness stedfastness|unsteadfast unstedfast|' +
  'thoroughly throughly|cloak cloke|awl aul|basin bason|basins basons|plaster plaister|plastered plaistered|' +
  'chestnut chesnut|loathe lothe|loathed lothed|loatheth lotheth|loathing lothing|entreaties intreaties|' +
  'entreaty intreaty|enclose inclose|enclosed inclosed|inquire enquire|inquired enquired|inquiry enquiry|' +
  'inquirest enquirest|ceiled cieled|ceiling cieling|subtle subtil|subtlety subtilty|subtly subtilly|' +
  'rearward rereward|jubilee jubile|veil vail|veils vails|spew spue|spewed spued|cuckoo cuckow|mixed mixt|' +
  'soldering sodering|carcass carcase|carcasses carcases|prancing pransing|prancings pransings|raze rase|' +
  'moldy mouldy|sponge spunge|graft graff|grafted graffed|braided broided|sycamore sycomore|sycamores sycomores|' +
  'clefts clifts|marshes marishes|public publick|music musick|garlic garlick|heretic heretick|lunatic lunatick|' +
  'traffic traffick|bishopric bishoprick|always alway|portray pourtray|portrayed pourtrayed|hoisted hoised|' +
  'chrysoprase chrysoprasus|peeled pilled|strewed strowed strawed|judgment judgement|judgments judgements|o oh';

/** Words written joined, split or hyphenated ("first-born", "for ever"). */
export const COMPOUND_WORDS =
  'firstborn,first born|forever,for ever|forevermore,for evermore|anything,any thing|everything,every thing|' +
  'everywhere,every where|tomorrow,to morrow|meanwhile,mean while|firstfruits,first fruits|firstripe,first ripe|' +
  'underfoot,under foot|wayside,way side|highway,high way|stronghold,strong hold|strongholds,strong holds|' +
  'threshingfloor,threshing floor|threshingfloors,threshing floors|stumblingblock,stumbling block|' +
  'stumblingblocks,stumbling blocks|dwellingplace,dwelling place|dwellingplaces,dwelling places|' +
  'maidservant,maid servant|maidservants,maid servants|manservant,man servant|menservants,men servants|' +
  'fellowservant,fellow servant|fellowservants,fellow servants|fellowprisoner,fellow prisoner|' +
  'fellowsoldier,fellow soldier|fellowworkers,fellow workers|fellowcitizens,fellow citizens|' +
  'fellowheirs,fellow heirs|evildoer,evil doer|evildoers,evil doers|wrongdoing,wrong doing|' +
  'armorbearer,armor bearer|stiffnecked,stiff necked|seashore,sea shore|seacoast,sea coast|' +
  'cornerstone,corner stone|watchtower,watch tower|doorpost,door post|doorposts,door posts|storehouse,store house|' +
  'storehouses,store houses|daytime,day time|lifetime,life time|wineskins,wine skins|turtledove,turtle dove|' +
  'turtledoves,turtle doves|earrings,ear rings|hailstones,hail stones|plumbline,plumb line|' +
  'handbreadth,hand breadth|holyday,holy day|shoulderpieces,shoulder pieces|pruninghooks,pruning hooks|' +
  'fleshhooks,flesh hooks|buryingplace,burying place|cankerworm,canker worm|palmerworm,palmer worm|' +
  'laughingstock,laughing stock|sheepshearers,sheep shearers|hillside,hill side|twoedged,two edged|' +
  'fourfooted,four footed|leanfleshed,lean fleshed|ofttimes,oft times|preeminence,pre eminence|' +
  'freewoman,free woman|freeman,free man|freewill,free will|cannot,can not,cant|bethel,beth el|' +
  'bethelite,beth elite|bethlehem,beth lehem|beersheba,beer sheba|bathsheba,bath sheba|abednego,abed nego|' +
  'nebuzaradan,nebuzar adan|rabshakeh,rab shakeh|rabsaris,rab saris|malchishua,malchi shua,melchishua,melchi shua|' +
  'abiezer,abi ezer|abiezrite,abi ezrite|abiezrites,abi ezrites|ebenezer,eben ezer|endor,en dor|' +
  'hephzibah,hephzi bah|potiphera,poti phera,potipherah,poti pherah|selfwilled,self willed|selfwill,self will|' +
  'selfcontrol,self control';

/** Short forms and the words they stand for. */
export const SHORT_FORMS =
  'dont,do not|isnt,is not|arent,are not|didnt,did not|havent,have not|shouldnt,should not|doesnt,does not|' +
  'hasnt,has not|wasnt,was not|couldnt,could not|wouldnt,would not';
