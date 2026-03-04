# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end
Faker::Config.locale = 'ja'

TITLES = ["縫子", "鵺", "抜打ち獅子兵衛", "ヌキのいない旅", "抜髪", "脱殻", "ヌスビトト　コヒツヂ", "盗まれた手紙", "盗まれた手紙の話", "窃む女"]
NAMES = ["宮本 A", "小川 B", "今野 C", "若山 D", "森川 E", "徳田 F", "槙村 G", "萩原 H", "高浜 I", "高浜 J"]
KATAKANA = ["ブレーキ", "アップル", "ヱヴァンゲリオン", "ビックカメラ", "エクスプロージョン", "プラスアルファ", "イッセキニチョウ", "ガンダム", "メグロ", "アオイトリ"]
PHRASES = [
  "私が沼津に越して来ていつか七年経つた。",
  "生長するに従って、その眼も、慾望も変化し進歩しているのだ。",
  "とんでもない。",
  "我々は心から彼を歓迎した。",
  "沼田の蚊帳",
  "時は移つて行ゆく。",
  "ブリキ屋根の上に、糠ぬかのような雨が降っている。",
  "時は寛永十九年二月。",
  "ある時とき天子てんしさまがたいそう重おもい不思議ふしぎな病やまいにおかかりになりました。",
  "二階の掃除をすませ、緩（ゆっ）くり前かけなどをとって六畳に出て見ると、お針子はもう大抵皆来ていた。"
]
TEXTS = [
  "私が沼津に越して来ていつか七年経つた。或はこのまゝ此処に居据わることになるかも知れない。沼津に何の取柄があるではないが、唯だ一つ私の自慢するものがある。千本松原である。\n
  千本松原位ゐ見事な松が揃つてまたこの位ゐの大きさ豊さを持つた松原は恐らく他に無いと思ふ。狩野川の川口に起つて、千本浜、片浜、原、田子の浦の海岸に沿ひ徐おもむろに彎曲しながら遠く西、富士川の川口に及んでゐる。長さにして四里に近く、幅は百間以上の広さを保つて続いてをる。この全体を千本松原といふは或は当らないかも知れないが、而しかも寸分の断え間なく茂り合つて続き渡つてゐるのである。而して普通いふ千本松原、即ち沼津千本浜を中心とした辺が最もよく茂つて居る。松は多く古松、二抱へ三抱へのものが眼の及ぶ限りみつちりと相並んで聳え立つてゐるのである。ことに珍しいのはすべて此処の松には所謂いわゆる磯馴松そなれまつの曲りくねつた姿態がなく、杉や欅に見る真直な幹を伸ばして矗々ちくちくと聳えて居ることである。",
  "今一つ二つ松原の特色として挙げたいのは、単に松ばかりが砂の上に並んでゐる所謂白砂青松式でないことである。白砂青松は明るくて綺麗ではあるが、見た感じが浅い、飽き易い。此処には聳え立つた松の下草に見ごとな雑木林が繁茂してゐるのである。下草だの雑木だのと云つても一握りの小さな枝幹を想像してはいけない。いづれも一抱へ前後、或はそれを越えてゐるものがある。\n
  その種類がまたいろ／＼である。最も多いのはたぶ、犬ゆづり葉の二種類で、一は犬樟いぬくすとも玉樟ともいふ樟科の木であり、一は本当のゆづり葉の木のやゝ葉の小さいものである。そして共にかゞやかしい葉を持つた常緑樹である。その他冬青木もち、椿、楢、櫨はぜ、楝おうち、椋むく、とべら、胡頽子ぐみ、臭木等多く、※(「木＋怱」、第3水準1-85-87)たらなどの思ひがけないものも立ち混つてゐる。而して此等の木々の根がたには篠や虎杖いたどりが生え、まんりやう藪柑子が群がり、所によつては羊歯しだが密生してをる。さういふ所に入つてゆくと、もう浜の松原の感じではない。森林の中を歩く気持である。",
  "順序としてこれ等の木の茂み、またはその木の実に集まつて来るいろ／＼の鳥の事を語らねばならぬ。が、不幸にして私はたゞ徒いたずらにその微妙な啼き声を聴き、愛らしい姿を見るだけで、その名を知らぬ。僅わずかに其処に常住する鴉からす――これもこの大きな松の梢の茂みの中に見る時おもひの外の美しい姿となるものである、ことに雨にいゝ――季節によつて往来する山雀やまがら、四十雀しじゆうから、松雀まつめ、鵯ひよどり、椋鳥、鶫つぐみ、百舌鳥もず、鶯、眼白めじろ、頬白ほおじろ等を数ふるに過ぎぬ。有明月の影もまだ明らかな暁に其処に入つてゆけば折々啄木鳥きつつきの鋭い姿と声とに出会ふ。\n
  夜はまた遠く近く梟ふくろうの声が起る。見ごとなのは椋鳥の群るゝ時で数百羽のこの鳥が中空に聳えた老松の梢から梢を群れながら渡つてゆくのは壮観である。",
  "二回目の時は、面会許可の通知が、さし迫って前日に届きましたため、充分の用意もなく、一人であわてて駆けつけました。そして、長く待たされた後、ゆっくり面会が出来ました。\n
  帰りは夕方になりました。兵営から鉄道の駅まで、一里ばかり、歩きなれない足を運びました。畑中の街道で、トラックが通ると濛々たる埃をまきあげました。西空は薄曇り、陽光が淡くなってゆきました。面会帰りの人々の姿が、ちらりほらり見えますのが、時にとっての心頼りでした。",
  "わりに大きな次の駅まで、二里あまり歩いて行けば、東京方面への切符があるかも知れませんでしたし、あるいは、そこで交叉してる他の鉄道線から迂回して、東京方面へ行けるかも知れませんでした。\n
  駅内の人々は、次第に散ってゆきました。けれどまだ、多くの者が、立ち話をしたり、腰掛にもたれたりしていました。",
  "薄汚れた暖簾のさがってる蕎麦屋がありました。黒ずんだ卓子が土間に並んでいて、やはり兵営での面会帰りと見える人たちが、代用食らしい丼物を食べていました。\n
  八重子もそこにはいってゆき、お茶を飲みました。そしてお上さんにいろいろ尋ねてみて、この辺には宿屋もなく、乗り物もなく、泊めてくれる家も恐らくないことを、知りました。",
  "その眩いに似たものを、また、駅の木の腰掛の上で、八重子は感じました……。
  腰掛にいる人々は、もうまばらで、誰も口を利きませんでした。うとうと居眠ってる者もありました。ただ眼を宙に見開いてるだけの者もありました。地下足袋の男が、ちょっと駅にはいって来て、すぐに出て行きました。そのあと一層ひっそりとしました。秋の夜風が軽く然し冷かに、駅内を通りぬけてゆきました。\n
  時間が、一分一秒はひどく緩かに、全体としては思いのほか速く、過ぎてゆきました。八時すぎの上り列車はもう通過してしまいました。",
  "ああ、奥さん、」\n
  と返事をした声は、確たしかに耳に入いって、判然はっきり聞こえて、はッと一ツ胸を突かれて、身体からだのどっかが、がっくりと窪くぼんだ気がする。\n
  そこで、この返事をしたのは、よくは覚えぬけれども、何でも、誰かに呼ばれたのに違いない。――呼んだのは、室の扉ひらきの外からだった――すなわち、閨ねやの戸を音訪おとずれられたのである。",
  "但し閨の戸では、この室には相応そぐわぬ。寝ているのは、およそ十五畳ばかりの西洋室ま……と云うが、この部落における、ある国手いしゃの診察室で。
  小松原は、旅行中、夏の一夜ひとよを、知己ちかづきの医学士の家に宿ったのであった。\n
  隙間漏る夜半よわの風に、ひたひたと裙すその靡なびく、薄黒い、ものある影を、臆病おくびょうのために嫌うでもなく、さればとて、群むらがり集たかる蚊の嘴くちばしを忍んでまで厭いとうほどこじれたのでもないが、鬱陶うっとうしさに、余り蚊帳を釣るのを好まず。",
  "当人寝惚ねぼけている癖に、他ひとの目色めつきの穿鑿せんさくどころか。けれども、その……ぱっちりと瞳の清すずしい、色の白い、髪の濃い、で、何に結ったか前髪のふっくりとある、俯向うつむき加減の、就中なかんずく、歴然ありありと目に残るのは、すっと鼻筋の通った……\n
  ここまで来ると、この家やの細君の顔ではない。それはもっと愛嬌あいきょうがあって、これはそれよりも品が優る。",
]

puts "Clearing Circle DB..."
Circle.destroy_all
puts "Clearing User DB..."
User.destroy_all
puts "Clearing Works DB..."
Work.destroy_all
puts "Clearing Events DB..."
Event.destroy_all

puts "Creating Circles..."
50.times do
  Circle.create!(
    name: [NAMES.sample, Faker::Creature::Animal.name].sample,
    name_reading: KATAKANA.sample,
    description: TEXTS.sample
  )
end

puts "...#{Circle.count} circles created"
puts "Creating Works and Circle Works..."

100.times do
  medium = ["book", "CD", "DVD", "USB", "PDF"].sample
  digital = [true, false].sample
  work = Work.new(
    title: [TITLES.sample, Faker::FunnyName.name].sample,
    title_reading: KATAKANA.sample,
    version: ["", rand(1..3).to_s].sample,
    description: TEXTS.sample,
    published_on: Date.today,
    orig_published_on: Date.today - 1,
    medium: medium,
    size: medium == "book" ? ["A4", "B5", "A3"].sample : "",
    download_source: digital ? ["DLsite", "Melonbooks", "Toranoana"].sample : "",
    digital: digital,
    adult: [true, false].sample
  )
  work.save!
  circle_work = CircleWork.new
  circle_work.work = work
  circle_work.circle = Circle.all.sample
  circle_work.save!
end

puts "...#{Work.count} works created"
puts "...#{CircleWork.count} circle works created"
puts "Creating Users, Collections, and Collection Works..."

5.times do |i|
  user = User.create!(
    username: Faker::Internet.unique.username,
    email: "email#{i}@domain.com",
    password: "123456",
    date_of_birth: Date.today
  )
  collection = Collection.new(
    name: "Inventory"
  )
  collection.user = user
  collection.save!
  works = Work.all.sample(50)
  works.each do |work|
    collection_work = CollectionWork.new(
      notes: Faker::Lorem.paragraph
    )
    collection_work.collection = collection
    collection_work.work = work
    collection_work.save!
  end
end

puts "...#{User.count} users created"
puts "...#{Collection.count} collections created"
puts "...#{CollectionWork.count} collection works created"
puts "Creating Events, Bookmarked Events, Booths, Favorites, Notifications, and Booth Works..."

10.times do
  event = Event.create!(
    name: Faker::FunnyName.unique.name,
    venue: Faker::Company.name,
    description: TEXTS.sample,
    start_date: Date.today,
    end_date: Date.today + 1
  )
  bookmarked_event = BookmarkedEvent.new
  bookmarked_event.user = User.all.sample
  bookmarked_event.event = event
  bookmarked_event.save!
  num = rand(10..20)
  sample_arr = Circle.all.sample(num)
  num.times do |i|
    booth = Booth.new(
      booth_day: [event.start_date, event.end_date].sample,
      booth_space: (i + 1).to_s,
      genre: Faker::Book.genre,
      description: TEXTS.sample
    )
    booth.event = event
    booth.circle = sample_arr[i]
    booth.save!
    favorite = Favorite.new(
      priority: [nil, rand(1..9)].sample,
      notes: Faker::Lorem.paragraph
    )
    favorite.booth = booth
    favorite.user = User.all.sample
    favorite.save!
    rand(3..5).times do
      notification = Notification.new(
        source: Faker::Bank.name,
        content: Faker::Lorem.paragraph,
        url: Faker::Internet.url,
        read: [true, false].sample
      )
      notification.booth = booth
      notification.save!
    end
    rand(1..5).times do
      booth_work = BoothWork.new(
        title: [TITLES.sample, Faker::FunnyName.name].sample,
        circle: booth.circle.name,
        price: rand(1..15) * 100,
        new: [true, false].sample,
        limit: [nil, rand(1..2)].sample,
        num_to_buy: rand(1..3),
        num_bought: 0,
        notes: Faker::Lorem.paragraph
      )
      booth_work.booth = booth
      booth_work.save!
    end
  end
end

puts "...#{Event.count} events created"
puts "...#{BookmarkedEvent.count} bookmarked events created"
puts "...#{Booth.count} booths created"
puts "...#{Favorite.count} favorites created"
puts "...#{Notification.count} notifications created"
puts "...#{BoothWork.count} booth works created"
