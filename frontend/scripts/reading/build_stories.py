"""Builds data/reading/{a1,a2,b1,b2}.json.

- A1/A2: short simplified retellings of public-domain tales, written for this app.
- B1/B2: original Brothers Grimm text (7th ed., 1857, public domain), fetched from
  de.wikisource.org into grimm_1857_raw.json.
"""
import json, os

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "..", "data", "reading")

SIMPLE = {
  "A1": [
    ("rotkaeppchen", "Rotkäppchen", "Little Red Riding Hood", "Märchen (retold)", [
      "Rotkäppchen ist ein kleines Mädchen. Es trägt immer eine rote Mütze. Die Großmutter wohnt im Wald. Sie ist krank.",
      "Rotkäppchen nimmt einen Korb mit Brot und Kuchen. Es geht durch den Wald. Da kommt ein Wolf. „Guten Tag, Rotkäppchen! Wohin gehst du?“ – „Zu meiner Großmutter“, sagt das Mädchen.",
      "Der Wolf läuft schnell zum Haus. Er isst die Großmutter und liegt im Bett. Rotkäppchen kommt. „Großmutter, du hast so große Augen!“ – „Damit ich dich besser sehen kann!“",
      "Ein Jäger hört einen lauten Schnarch. Er kommt ins Haus und rettet die Großmutter. Alle sind froh und essen den Kuchen."]),
    ("die-bremer-stadtmusikanten-einfach", "Die vier Freunde", "The Four Friends (Town Musicians of Bremen)", "Märchen (retold)", [
      "Ein Esel ist alt. Der Bauer will ihn nicht mehr. Der Esel geht nach Bremen. Er will dort Musik machen.",
      "Auf dem Weg trifft er einen Hund. Der Hund ist auch alt. „Komm mit!“, sagt der Esel. Dann treffen sie eine Katze und einen Hahn. Jetzt sind sie vier Freunde.",
      "Es ist Nacht. Sie sehen ein Haus im Wald. Dort wohnen Räuber. Die Tiere machen laut Musik: „I-A! Wau! Miau! Kikeriki!“ Die Räuber haben Angst und laufen weg.",
      "Die Tiere bleiben im Haus. Sie haben Essen und ein Bett. Sie sind glücklich und gehen nie nach Bremen."]),
    ("der-alte-mann-und-das-kind", "Der Opa und das Kind", "Grandpa and the Child", "Märchen (retold)", [
      "Opa Karl ist sehr alt. Er wohnt bei seinem Sohn. Seine Hände zittern. Beim Essen fällt oft etwas auf den Tisch.",
      "Der Sohn ist nicht froh. „Du isst jetzt in der Ecke“, sagt er. Opa bekommt eine kleine Holzschüssel. Er ist traurig.",
      "Eines Tages baut der kleine Enkel etwas mit Holz. „Was machst du?“, fragt der Vater. „Ich baue eine Schüssel für dich, für später“, sagt das Kind.",
      "Der Vater weint. Er holt Opa zurück an den Tisch. Jetzt essen alle zusammen."]),
    ("haensel-und-gretel", "Hänsel und Gretel", "Hansel and Gretel", "Märchen (retold)", [
      "Hänsel und Gretel sind Bruder und Schwester. Sie wohnen mit ihrem Vater und ihrer Stiefmutter im Wald. Die Familie ist sehr arm. Es gibt fast kein Essen.",
      "Eines Abends hören die Kinder ihre Eltern. „Wir haben kein Brot mehr“, sagt die Stiefmutter. „Morgen bringen wir die Kinder tief in den Wald.“ Hänsel hat einen Plan. Er sammelt weiße Steine.",
      "Am nächsten Tag gehen alle in den Wald. Hänsel wirft die Steine auf den Weg. Am Abend sind die Eltern weg. Die Kinder warten. Dann scheint der Mond, und die Steine leuchten. So finden Hänsel und Gretel nach Hause.",
      "Ein paar Tage später gehen sie wieder in den Wald. Diesmal hat Hänsel nur Brot. Er wirft das Brot auf den Weg. Aber die Vögel essen alles. Die Kinder sind allein und haben Angst.",
      "Plötzlich sehen sie ein kleines Haus. Es ist aus Brot, Kuchen und Zucker! Die Kinder haben großen Hunger und essen vom Dach. Da kommt eine alte Frau. „Kommt herein, liebe Kinder“, sagt sie. Aber die Frau ist eine Hexe.",
      "Die Hexe sperrt Hänsel ein. Gretel muss arbeiten. Eines Tages schaut die Hexe in den Ofen. Gretel schiebt sie hinein und macht die Tür zu. Die Hexe ist weg!",
      "Die Kinder finden Gold und Edelsteine im Haus. Sie nehmen alles mit und gehen nach Hause. Die Stiefmutter ist nicht mehr da. Der Vater weint vor Freude. Jetzt sind sie nie mehr arm."]),
    ("die-stadtmaus-und-die-landmaus", "Die Stadtmaus und die Landmaus", "The Town Mouse and the Country Mouse", "Fabel (Aesop, retold)", [
      "Eine kleine Maus wohnt auf dem Land. Ihr Haus ist klein, aber schön. Sie isst Körner und Beeren. Das Leben ist einfach und ruhig.",
      "Eines Tages kommt ihre Freundin aus der Stadt zu Besuch. „Dein Essen ist nicht gut“, sagt die Stadtmaus. „Komm mit mir in die Stadt! Dort gibt es Käse, Kuchen und Wurst.“",
      "Die Landmaus geht mit. Das Haus in der Stadt ist groß und warm. Auf dem Tisch stehen viele gute Sachen. Die Landmaus isst und isst. Sie ist sehr glücklich.",
      "Da öffnet sich die Tür. Ein großer Hund bellt laut! Die Mäuse laufen schnell in ein Loch. Die Landmaus zittert vor Angst.",
      "„Das ist hier jeden Tag so“, sagt die Stadtmaus. Die Landmaus schüttelt den Kopf. „Dann gehe ich nach Hause“, sagt sie. „Ich esse lieber wenig, aber ich habe keine Angst.“"]),
    ("der-wolf-und-die-sieben-geisslein", "Der Wolf und die sieben Geißlein", "The Wolf and the Seven Young Goats", "Märchen (retold)", [
      "Eine Ziege wohnt mit ihren sieben Kindern im Haus. Eines Tages muss sie in den Wald gehen. „Passt auf den Wolf auf!“, sagt sie. „Er hat eine rauhe Stimme und schwarze Füße. Macht die Tür nicht auf!“",
      "Bald klopft es. „Macht auf, liebe Kinder! Eure Mutter ist da“, ruft jemand. Aber die Stimme ist tief und rauh. „Du bist nicht unsere Mutter!“, rufen die Geißlein.",
      "Der Wolf geht zum Bäcker und zum Müller. Er bekommt weißes Mehl für seine Füße. Dann isst er Kreide, und seine Stimme wird weich. Er klopft wieder an die Tür.",
      "Diesmal sehen die Kinder die weißen Füße. Sie glauben ihm und machen die Tür auf. Der Wolf springt ins Haus! Sechs Geißlein laufen weg und verstecken sich. Nur das jüngste ist in der Uhr und sieht der Wolf nicht.",
      "Am Abend kommt die Mutter nach Hause. Das jüngste Geißlein erzählt alles. Die Mutter findet den Wolf im Garten. Er schläft fest. Sie schneidet seinen Bauch auf, und die sechs Kinder springen heraus – sie sind gesund!",
      "Die Familie legt große Steine in den Bauch des Wolfes. Als er aufwacht, hat er Durst und geht zum Brunnen. Er fällt hinein und kommt nie wieder heraus."]),
    ("der-gestiefelte-kater", "Der gestiefelte Kater", "Puss in Boots", "Märchen (Perrault, retold)", [
      "Ein Müller stirbt und hinterlässt seinen drei Söhnen etwas: Der älteste bekommt die Mühle, der zweite den Esel, und der jüngste bekommt nur den Kater. „Was soll ich mit einer Katze?“, fragt er traurig.",
      "Aber der Kater kann sprechen. „Gib mir Stiefel und einen Sack“, sagt er. „Dann wird alles gut.“ Der junge Mann gibt ihm beides.",
      "Der Kater fängt einen Hasen und bringt ihn zum König. „Das ist ein Geschenk von meinem Herrn, dem Grafen von Carabas“, sagt er. Der König freut sich. Das macht der Kater viele Tage lang.",
      "Eines Tages führt der Kater seinen Herrn zum Fluss und sagt: „Zieh deine Kleider aus und spring ins Wasser!“ Dann kommt der König mit seiner Tochter. Der Kater ruft: „Hilfe! Mein Herr ertrinkt!“ Der König gibt dem jungen Mann schöne Kleider.",
      "Die Prinzessin findet den jungen Mann sehr nett. Am Ende heiraten die beiden. Der Kater ist jetzt ein großer Herr und fängt nur noch zum Spaß Mäuse."]),
  ],
  "A2": [
    ("der-hase-und-der-igel", "Der Hase und der Igel", "The Hare and the Hedgehog", "Märchen (retold)", [
      "An einem Sonntagmorgen steht der Igel vor seinem Haus. Die Sonne scheint und er singt ein kleines Lied. Er will auf dem Feld nach Rüben sehen.",
      "Auf dem Feld trifft er den Hasen. Der Hase lacht über die kurzen Beine des Igels. „Mit diesen Beinen kommst du nirgendwohin!“, sagt er. Der Igel ist böse. „Wir können um die Wette laufen“, sagt er. „Ich gewinne.“",
      "Der Igel geht kurz nach Hause und spricht mit seiner Frau. „Du stehst am Ende des Feldes und rufst: Ich bin schon da!“, sagt er. Die beiden Igel sehen sich sehr ähnlich.",
      "Dann beginnt das Rennen. Der Hase rennt wie der Wind. Aber am Ende ruft die Igelfrau: „Ich bin schon da!“ Der Hase kann es nicht glauben. Er läuft zurück – und wieder ruft jemand: „Ich bin schon da!“",
      "Der Hase läuft den ganzen Tag hin und her. Am Abend fällt er müde um. Der Igel hat gewonnen, und der Hase lacht nie wieder über andere."]),
    ("die-sterntaler-einfach", "Die Sterntaler", "The Star Money", "Märchen (retold)", [
      "Es war einmal ein kleines Mädchen. Seine Eltern waren tot. Es hatte kein Haus und kein Bett, nur die Kleider am Körper und ein Stück Brot in der Hand.",
      "Das Mädchen ging durch das Land. Da traf es einen armen Mann. „Ich habe so großen Hunger“, sagte er. Das Mädchen gab ihm sein Brot. Später traf es ein Kind, das fror. Das Mädchen gab ihm seine Mütze.",
      "Es wurde Nacht und kalt. Im Wald fand das Mädchen noch mehr Kinder, die keine Kleider hatten. Es gab ihnen sein Jäckchen und sein Röckchen. Am Ende hatte es nur noch sein Hemd.",
      "Plötzlich fielen Sterne vom Himmel. Sie wurden zu Goldstücken. Das Mädchen hatte ein neues Hemd aus feinstem Stoff. Es sammelte das Gold und war für immer reich."]),
    ("der-fuchs-und-die-trauben", "Der Fuchs und die Trauben", "The Fox and the Grapes", "Fabel (Aesop, retold)", [
      "Ein Fuchs ging an einem heißen Tag durch einen Garten. Er hatte großen Durst und Hunger. Da sah er hoch oben schöne, süße Trauben.",
      "„Die sind genau richtig für mich!“, dachte der Fuchs. Er sprang hoch, aber er kam nicht an die Trauben. Er versuchte es noch einmal und noch einmal. Es half nichts.",
      "Müde setzte er sich hin. „Ach, die Trauben sind bestimmt sauer“, sagte er. „Ich will sie gar nicht.“ Dann ging er weg, mit hoch erhobenem Kopf.",
      "Manche Menschen sagen auch: Was ich nicht haben kann, ist nicht gut. So ist es auch beim Fuchs."]),
    ("schneewittchen-einfach", "Schneewittchen", "Snow White", "Märchen (retold)", [
      "Es war einmal eine Königin. Sie wünschte sich ein Kind mit Haut so weiß wie Schnee, Lippen so rot wie Blut und Haaren so schwarz wie Ebenholz. Bald bekam sie eine Tochter und nannte sie Schneewittchen. Leider starb die Königin kurz danach.",
      "Der König heiratete eine neue Frau. Sie war schön, aber auch sehr stolz. Sie hatte einen Zauberspiegel und fragte ihn jeden Tag: „Spieglein, Spieglein an der Wand, wer ist die Schönste im ganzen Land?“ Der Spiegel antwortete immer: „Frau Königin, Ihr seid die Schönste.“",
      "Als Schneewittchen sieben Jahre alt war, sagte der Spiegel plötzlich: „Schneewittchen ist tausendmal schöner als Ihr.“ Die Königin wurde sehr böse. Sie befahl einem Jäger, das Mädchen im Wald zu töten. Aber der Jäger hatte Mitleid. „Lauf weg und komm nie wieder!“, sagte er.",
      "Das arme Kind lief durch den dunklen Wald, bis es ein kleines Haus fand. Dort wohnten sieben Zwerge, die in den Bergen arbeiteten. Schneewittchen blieb bei ihnen und kochte und putzte. „Pass auf, öffne niemandem die Tür!“, sagten die Zwerge jeden Morgen.",
      "Aber der Spiegel verriet der Königin, wo Schneewittchen wohnte. Die Königin verkleidete sich dreimal als alte Händlerin. Beim dritten Mal brachte sie einen vergifteten Apfel. Schneewittchen biss hinein und fiel tot um.",
      "Die Zwerge weinten drei Tage lang. Sie legten das schöne Mädchen in einen gläsernen Sarg. Eines Tages kam ein Prinz vorbei und verliebte sich in sie. Seine Diener trugen den Sarg weg, und dabei fiel das Stück Apfel aus ihrem Hals. Schneewittchen wachte auf!",
      "Der Prinz und Schneewittchen heirateten. Die böse Königin kam auch zur Hochzeit. Als sie die Braut sah, erschrak sie so sehr, dass sie nie wieder jemandem etwas Böses tun konnte."]),
    ("aschenputtel-einfach", "Aschenputtel", "Cinderella", "Märchen (retold)", [
      "Ein reicher Mann hatte eine Tochter. Als seine Frau starb, heiratete er eine andere Frau mit zwei Töchtern. Die Stiefmutter und die Stiefschwestern waren nicht nett zu dem Mädchen. Sie musste den ganzen Tag arbeiten und schlief neben dem Herd in der Asche. Darum nannten alle sie Aschenputtel.",
      "Eines Tages lud der König alle jungen Frauen zu einem großen Fest ein. Der Prinz wollte eine Frau finden. Aschenputtel wollte auch gehen, aber die Stiefmutter lachte: „Du hast kein Kleid und keine Schuhe. Du bleibst hier!“",
      "Traurig ging das Mädchen zum Grab ihrer Mutter. Dort stand ein Baum, und ein kleiner weißer Vogel saß darin. „Schüttle dich, Bäumchen, und wirf Gold und Silber über mich!“, rief Aschenputtel. Da fiel ein wunderschönes Kleid mit goldenen Schuhen herunter.",
      "Auf dem Fest tanzte der Prinz nur mit ihr. Niemand erkannte das schöne Mädchen. Als es dunkel wurde, lief Aschenputtel schnell weg. Das passierte an drei Abenden. Am dritten Abend blieb ein goldener Schuh auf der Treppe kleben.",
      "Der Prinz sagte: „Ich heirate nur die Frau, der dieser Schuh passt.“ Er ging von Haus zu Haus. Die Stiefschwestern versuchten alles, aber der Schuh war zu klein. Da sagte Aschenputtel leise: „Darf ich es auch probieren?“",
      "Der Schuh passte genau. Der Prinz erkannte sie sofort und nahm sie mit auf sein Schloss. Bald feierten die beiden ihre Hochzeit. Aschenputtel war nie wieder traurig."]),
    ("der-fischer-und-seine-frau-einfach", "Der Fischer und seine Frau", "The Fisherman and His Wife", "Märchen (retold)", [
      "Ein Fischer lebte mit seiner Frau in einer kleinen, schlechten Hütte am Meer. Jeden Tag ging er angeln. Eines Tages fing er einen großen Fisch. Der Fisch sprach: „Bitte lass mich leben! Ich bin ein verzauberter Prinz.“ Der Fischer hatte Mitleid und warf den Fisch ins Wasser zurück.",
      "Zu Hause erzählte er alles seiner Frau. „Du hast dir nichts gewünscht?“, rief sie. „Geh zurück und wünsch dir ein schönes Haus!“ Der Fischer ging ans Meer und rief den Fisch. Das Wasser war grün und trüb. „Was willst du?“, fragte der Fisch. – „Meine Frau möchte ein Haus.“ – „Geh nach Hause, sie hat es schon.“",
      "Und wirklich: Dort stand ein hübsches Häuschen mit Garten. Aber nach einer Woche wollte die Frau mehr. „Ich will in einem Schloss wohnen!“, sagte sie. Der Fischer ging wieder zum Meer. Das Wasser war jetzt gelb und unruhig. Wieder erfüllte der Fisch den Wunsch.",
      "Bald war die Frau Königin, dann Kaiserin und sogar Papst. Mit jedem Wunsch wurde das Meer dunkler und der Sturm lauter. Der Fischer hatte große Angst.",
      "Zum Schluss sagte die Frau: „Ich will Gott werden!“ Der Fischer ging zitternd ans Meer. Es war schwarz, und der Wind heulte. „Geh nach Hause“, sagte der Fisch. „Deine Frau sitzt wieder in der kleinen Hütte.“ Dort wohnen die beiden noch heute."]),
    ("der-rattenfaenger-von-hameln", "Der Rattenfänger von Hameln", "The Pied Piper of Hamelin", "Sage (retold)", [
      "Im Jahr 1284 gab es in der Stadt Hameln ein großes Problem: Überall waren Ratten. Sie fraßen das Brot, das Korn und sogar das Essen der Kinder. Die Bürger wussten nicht mehr, was sie tun sollten.",
      "Eines Tages kam ein fremder Mann in die Stadt. Er trug bunte Kleider und hatte eine Flöte. „Ich kann euch helfen“, sagte er zum Bürgermeister. „Für tausend Taler vertreibe ich alle Ratten.“ Der Bürgermeister sagte sofort ja.",
      "Der Mann ging durch die Straßen und spielte auf der Flöte. Die Ratten kamen aus allen Häusern und folgten ihm. Er führte sie zum Fluss Weser. Dort fielen alle ins Wasser und waren verschwunden.",
      "Die Menschen freuten sich sehr. Aber als der Mann sein Geld wollte, lachte der Bürgermeister. „Für so wenig Arbeit tausend Taler? Hier hast du fünfzig!“ Der Rattenfänger wurde ernst. „Ihr werdet das bereuen“, sagte er und ging.",
      "Am Morgen des 26. Juni kam er zurück. Diesmal spielte er eine andere Melodie, sanft und schön. Alle Kinder der Stadt hörten sie. Sie liefen aus den Häusern, tanzten und folgten dem Mann aus der Stadt, zu einem Berg. Dort öffnete sich der Berg – und schloss sich wieder.",
      "Nur zwei Kinder blieben zurück: ein blindes und ein stummes. Sie konnten den Weg nicht sehen und nicht erzählen. Seit diesem Tag wurde die Stadt nie wieder fröhlich."]),
  ],
}

# Which Grimm tales to include and at what (approximate) level.
GRIMM = [
  # (key in grimm_1857_raw.json, id, displayed title, English title)
  ("Der alte Großvater und der Enkel", "der-alte-grossvater-und-der-enkel", None, "The Old Grandfather and His Grandson"),
  ("Der süße Brei", "der-suesse-brei", None, "The Sweet Porridge"),
  ("Der Fuchs und die Gänse", "der-fuchs-und-die-gaense", None, "The Fox and the Geese"),
  ("Die Wassernixe", "die-wassernixe", None, "The Water-Nix"),
  ("Strohhalm, Kohle und Bohne", "strohhalm-kohle-und-bohne", None, "Straw, Coal and Bean"),
  ("Von dem Mäuschen, Vögelchen und der Bratwurst", "maeuschen-voegelchen-bratwurst", None, "The Mouse, the Bird and the Sausage"),
  ("Die Bremer Stadtmusikanten", "die-bremer-stadtmusikanten", None, "The Bremen Town Musicians"),
  ("Frau Holle", "frau-holle", None, "Mother Holle"),
  ("Rumpelstilzchen", "rumpelstilzchen", None, "Rumpelstiltskin"),
  ("Rothkäppchen", "rotkaeppchen-grimm", "Rotkäppchen", "Little Red Riding Hood"),
  ("Die Wichtelmänner", "die-wichtelmaenner", None, "The Elves and the Shoemaker"),
  ("Die Bienenkönigin", "die-bienenkoenigin", None, "The Queen Bee"),
  ("Die sieben Raben", "die-sieben-raben", None, "The Seven Ravens"),
  ("Die drei Spinnerinnen", "die-drei-spinnerinnen", None, "The Three Spinners"),
  ("Der gescheidte Hans", "der-gescheite-hans", "Der gescheite Hans", "Clever Hans"),
  ("Der Wolf und der Fuchs", "der-wolf-und-der-fuchs", None, "The Wolf and the Fox"),
  ("Die Eule", "die-eule", None, "The Owl"),
  ("Die Hochzeit der Frau Füchsin", "die-hochzeit-der-frau-fuechsin", None, "The Wedding of Mrs. Fox"),
  ("Der Schneider im Himmel", "der-schneider-im-himmel", None, "The Tailor in Heaven"),
  ("Das Lumpengesindel", "das-lumpengesindel", None, "The Pack of Ragamuffins"),
  ("Die Alte im Wald", "die-alte-im-wald", None, "The Old Woman in the Wood"),
  ("Die drei Federn", "die-drei-federn", None, "The Three Feathers"),
  ("Der Hund und der Sperling", "der-hund-und-der-sperling", None, "The Dog and the Sparrow"),
  ("Dornröschen", "dornroeschen", None, "Sleeping Beauty"),
  ("Der Gevatter Tod", "der-gevatter-tod", None, "Godfather Death"),
  ("Der Hase und der Igel", "der-hase-und-der-igel-grimm", None, "The Hare and the Hedgehog (original)"),
  ("Rapunzel", "rapunzel", None, "Rapunzel"),
  ("Der Froschkönig oder der eiserne Heinrich", "der-froschkoenig", None, "The Frog King"),
  ("König Drosselbart", "koenig-drosselbart", None, "King Thrushbeard"),
  ("Der arme Müllerbursch und das Kätzchen", "der-arme-muellerbursch", None, "The Poor Miller's Boy and the Cat"),
  ("Der Liebste Roland", "der-liebste-roland", None, "Sweetheart Roland"),
  ("Die kluge Bauerntochter", "die-kluge-bauerntochter", None, "The Peasant's Clever Daughter"),
  ("Die goldene Gans", "die-goldene-gans", None, "The Golden Goose"),
  ("Die weiße Schlange", "die-weisse-schlange", None, "The White Snake"),
  ("Das Bürle", "das-buerle", None, "The Little Peasant"),
  ("Hans im Glück", "hans-im-glueck", None, "Hans in Luck"),
  ("Die Goldkinder", "die-goldkinder", None, "The Gold-Children"),
  ("Die Gänsemagd", "die-gaensemagd", None, "The Goose-Girl"),
  ("Aschenputtel", "aschenputtel-grimm", None, "Cinderella (original)"),
  ("Daumesdick", "daumesdick", None, "Thumbling"),
  ("Der Teufel mit den drei goldenen Haaren", "der-teufel-mit-den-drei-goldenen-haaren", None, "The Devil with the Three Golden Hairs"),
  ("Der goldene Vogel", "der-goldene-vogel", None, "The Golden Bird"),
  ("Sneewittchen", "sneewittchen-grimm", "Schneewittchen", "Snow White (original)"),
  ("Das tapfere Schneiderlein", "das-tapfere-schneiderlein", None, "The Brave Little Tailor"),
]

def grimm_level(words):
    # Original 1857 prose is hard going; only the very short tales are approachable at B1.
    return "B1" if words <= 700 else "B2"

def main():
    os.makedirs(OUT, exist_ok=True)
    by_level = {"A1": [], "A2": [], "B1": [], "B2": []}
    for level, items in SIMPLE.items():
        for id_, title, en, src, paras in items:
            by_level[level].append(dict(id=id_, title=title, titleEn=en, level=level, source=src, paragraphs=paras))
    raw = json.load(open(os.path.join(HERE, "grimm_1857_raw.json"), encoding="utf8"))
    for key, id_, title, en in GRIMM:
        paras = raw[key]
        level = grimm_level(sum(len(p.split()) for p in paras))
        by_level[level].append(dict(id=id_, title=title or key, titleEn=en, level=level,
                                    source="Brüder Grimm, Kinder- und Hausmärchen (1857) – de.wikisource.org", paragraphs=paras))
    for level, stories in by_level.items():
        for s in stories:
            s["words"] = sum(len(p.split()) for p in s["paragraphs"])
        with open(os.path.join(OUT, f"{level.lower()}.json"), "w", encoding="utf8") as f:
            json.dump(stories, f, ensure_ascii=False, indent=1)
        print(level, len(stories))

main()
