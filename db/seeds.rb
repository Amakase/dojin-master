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

filepath = "app/assets/csv/seed_info.csv"

m3_circles = []
CSV.foreach(filepath, headers: :first_row) do |row|
  m3_circles << {
    name: row['サークル名'],
    name_reading: row['サークル名'],
    booth_day: Date.new(2025, 4, 27),
    booth_space: "#{row['会場']} #{row['スペース']}",
    genre: row['ジャンル'],
    description: row['description'] }
end

KATAKANA = ["ブレーキ", "アップル", "ヱヴァンゲリオン", "ビックカメラ", "エクスプロージョン", "プラスアルファ", "イッセキニチョウ", "ガンダム", "メグロ", "アオイトリ"]

CIRCLES = [
  { name: "U.S.S.ユキカゼ",
    name_reading: "ユーエスエスユキカゼ",
    booth_day: Date.new(2025, 12, 31),
    booth_space: "西お10a",
    genre: "鉄道・旅行・メカミリ",
    description: "米SF-TV/映画シリーズ「スタートレック」の内、主に24世紀を舞台とする作品に登場する架空の宇宙船（及び科学技術）の考察＆解説本を製作。近年は3DCGを用いた撮影用モデルの考察なども行っています。" },
  { name: "GRINP",
    name_reading: "グリンプ",
    booth_day: Date.new(2025, 12, 31),
    booth_space: "西あ55b",
    genre: "創作(少年) ",
    description: "「お兄ちゃんはおしまい！」原作同人誌版シリーズとスピンオフ作品を頒布します。" },
  { name: "菊地桑港",
    name_reading: "キクチソウコウ",
    booth_day: Date.new(2025, 12, 30),
    booth_space: "南ｏ30a",
    genre: "アニメ(その他)",
    description: "ガールズバンドクライ（ガルクラ）の仁菜ヒナ二次創作漫画を分布する予定です", },
  { name: "緑化倶楽部",
    name_reading: "リョッカクラブ",
    booth_day: Date.new(2025, 12, 30),
    booth_space: "東Ｒ26b",
    genre: "艦これ",
    description: "艦これ本です。龍驤が主人公の賑やかな日常を描いています。公式設定に準じつつも、独自の設定やキャラクターを織り交ぜた自由な世界観を描きたいと思っています。全て健全ものです。" },
  { name: "ZINFANDEL",
    name_reading: "ジンファンデル",
    booth_day: Date.new(2025, 12, 30),
    booth_space: "東Ａ07ab ",
    genre: "ゲーム(ネット・ソーシャル)",
    description: "原神のイラスト集やグッズセットなどを作ります！" },
  { name: "Rolling Contact",
    name_reading: "ローリングコンタクト",
    booth_day: Date.new(2025, 12, 30),
    booth_space: "南ｓ04a",
    genre: "東方Project",
    description: "東方インストクラブ系アレンジ！Hardcoreを中心に、EDM、Trance、Hardstyle、Glitch Hop、Jungle Terrorなど、幅広いジャンルのクラブミュージックアレンジを制作しています。" },
  { name: "EasyGameStation",
    name_reading: "イージゲームステーション",
    booth_day: Date.new(2025, 12, 31),
    booth_space: "南ｌ42a",
    genre: "同人ソフト",
    description: "windows用ゲームを制作しているサークルです。現在はシミュレーションゲームテリトワールを鋭意製作中。" },
  { name: "PASTA'S ESTAB.",
    name_reading: "パスタズイスタブ",
    booth_day: Date.new(2025, 12, 31),
    booth_space: "西め41ab",
    genre: "創作(少年) ",
    description: "いつも通りのイラスト集の発行とカレンダーを予定しています。" },
  { name: "ビールの放課後",
    name_reading: "ビールノホウカゴ",
    booth_day: Date.new(2025, 12, 31),
    booth_space: "東ニ10a",
    genre: "評論・情報",
    description: "ビール書籍7冊の著述家・長谷川小二郎の出版ユニット。ビールに関して業界から独立した著述家として、公正中立なコンテンツを提供しています。年5回以上発行の最も頻度高く発行しているビール媒体「ビールの放課後」は、公正中立を目指し、濃い情報が満載、クラフトビール多め。「ビールと料理を合わせる基礎技術」第8刷2500部、「二日酔い本」第5刷1000部突破。この冬の新刊第1弾『歴史から考えるクラフトビール』は早くも第2刷の発行が決定。メンバー製作のグッズも。" },
  { name: "Electrical Babel",
    name_reading: "エレクトリカルバベル",
    booth_day: Date.new(2025, 12, 31),
    booth_space: "西か31a",
    genre: "鉄道・旅行・メカミリ",
    description: "主に東京電力PG管内の送電線・送電鉄塔を鑑賞し写真集を作成している新羽 碍の個人サークル。\n過去に発行した系統\n東京電力PG管内：港北線、野川線、北島線、橋本線、福島幹線、福島東幹線、常陸那珂火力線、東海原子力線、原研那珂線、柿生線、川崎火力線、秦浜線、西北線、北葛飾線、新野田線、新京葉線（新古河～新野田分岐部/新野田分岐部～新京葉変電所 の2回に分けて制作）、新京葉変電所、千葉印西変電所、新座線
東北電力NW管内：新仙台火力線" },
  { name: "蜜柑工房",
    name_reading: "ミカンコウボウ",
    booth_day: Date.new(2025, 12, 31),
    booth_space: "東サ10b",
    genre: "アイドルマスター",
    description: "渋谷凛の1/3ドールやフィギュア写真集などの頒布を予定しています。"},
  { name: "はづき倶楽部",
    name_reading: "ハヅキクラブ",
    booth_day: Date.new(2025, 12, 31),
    booth_space: "南ｈ17b",
    genre: "同人ソフト",
    description: "Android用のコミケwebカタログを見るアプリCC-Viewerを実機でデモ展示。導入方法のチラシを配布。缶バッジの無料配布やグッズや本の頒布も予定。"},
  { name: "赤松スタジオ",
    name_reading: "アカマツスタジオ",
    booth_day: Date.new(2025, 12, 31),
    booth_space: "東ア40a",
    genre: "評論・情報",
    description: "国会レポートマンガ「赤松健の国会にっき」をメインに頒布いたします。"},
  { name: "南武旅客鉄道",
    name_reading: "ナンブリョキャクテツドウ",
    booth_day: Date.new(2025, 12, 30),
    booth_space: "東タ41a",
    genre: "評論・情報",
    description: "交通系限界イベンターによるハシゴ理論値考察論文集。"}
]

WORKS = [
  { circle: "GRINP", title: "お兄ちゃんはおしまい!35", size: "B5", new_release: true },
  { circle: "GRINP", title: "みなとくんはおしまい？３", size: "B5", new_release: true },
  { circle: "GRINP", title: "お兄ちゃんはおしまい！３４", size: "B5", new_release: false },
  { circle: "GRINP", title: "みなとくんはおしまい？２", size: "B5", new_release: false },
  { circle: "GRINP", title: "みなとくんはおしまい？", size: "B5", new_release: false },
  { circle: "菊地桑港", title: "DOG PROBLEMS", size: "A5", new_release: true },
  { circle: "菊地桑港", title: "今日から私は", size: "A5", new_release: false }
]

EVENTS = [
  {
    name: "M3-2025春",
    venue: "東京流通センター(TRC) 第一展示場・第二展示場",
    description: "自主制作音系作品の展示即売会。試聴コーナー・上映コーナー併設",
    start_date: Date.new(2025, 4, 27),
    end_date: Date.new(2025, 4, 27)
  },
  {
    name: "Comic Market 107",
    venue: "Tokyo Big Sight",
    description: "Comic Market is a doujinshi marketplace that started in 1975 as a \"space\" reserved for people to pursue new possibilities in creative expression in the realm of manga and to act as a forum for communication between fans. ",
    start_date: Date.new(2025, 12, 30),
    end_date: Date.new(2025, 12, 31)
  }
]

puts "Clearing Circle DB..."
Circle.destroy_all
puts "Clearing User DB..."
User.destroy_all
puts "Clearing Works DB..."
Work.destroy_all
puts "Clearing Events DB..."
Event.destroy_all


puts "Creating M3-2025 Spring Circles"

m3_circles.each do |circle|
  Circle.create!(
    name: circle[:name],
    name_reading: circle[:name_reading],
    description: circle[:description]
  )
end

num_circles = Circle.count
puts "...#{num_circles} circles created"
puts "Creating a few Comiket circles..."

CIRCLES.each do |circle|
  Circle.create!(
    name: circle[:name],
    name_reading: circle[:name_reading],
    description: Faker::Lorem.paragraph
  )
end

puts "...#{Circle.count - num_circles} circles created"
# num_circles = Circle.count
# puts "Creating fake Circles..."
#
# 50.times do
#   Circle.create!(
#     name: Faker::Creature::Animal.name,
#     name_reading: KATAKANA.sample,
#     description: Faker::Lorem.paragraph
#   )
# end
#
# puts "...#{Circle.count - num_circles} circles created"
puts "...#{Circle.count} total circles created"
puts "Creating fully-fake Works and Circle Works..."

200.times do
  medium = ["book", "CD", "DVD", "USB", "PDF"].sample
  digital = [true, false].sample
  work = Work.new(
    title: Faker::FunnyName.name,
    title_reading: KATAKANA.sample,
    version: ["", rand(1..3).to_s].sample,
    description: Faker::Lorem.paragraph,
    published_on: Date.today,
    orig_published_on: [nil, Date.today - 1].sample,
    medium: medium,
    size: medium == "book" ? ["A4", "B5", "A3"].sample : "",
    download_source: digital ? ["DLsite", "Melonbooks", "Toranoana"].sample : "",
    digital: digital,
    adult: [true, false].sample
  )
  work.save!
  circle_work = CircleWork.new
  circle_work.work = work
  circle_work.circle = Circle.all.first(20).sample
  circle_work.save!
end

puts "...#{Work.count} works created"
puts "...#{CircleWork.count} circle works created"
puts "Creating fully-fake Users, Collections, and Collection Works..."

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

EVENTS.each do |this_event|
  event = Event.new(
    name: this_event[:name],
    venue: this_event[:venue],
    description: this_event[:description],
    start_date: this_event[:start_date],
    end_date: this_event[:end_date]
  )
  file_path = "app/assets/images/events/#{event.name}.png"
  puts file_path
  if File.exist?(file_path)
    event.image = File.open(Rails.root.join(file_path))
  end
  event.save!
  User.all.each do |user|
    bookmarked_event = BookmarkedEvent.new
    bookmarked_event.user = user
    bookmarked_event.event = event
    bookmarked_event.save!
  end
  if event.name == "M3-2025春"
    seed_circles = m3_circles
  elsif event.name == "Comic Market 107"
    seed_circles = CIRCLES
  else
   seed_circles = []
  end
  seed_circles.each_with_index do |circle, i|
    booth = Booth.new(
      booth_day: circle[:booth_day],
      booth_space: circle[:booth_space],
      genre: circle[:genre],
      description: circle[:description]
    )
    booth.event = event
    booth.circle = Circle.find_by(name: circle[:name])
    if event.name == "M3-2025春"
      file_path = "app/assets/images/m3_circle_cuts/★_#{booth.booth_space.split.last}.jpeg"
    elsif event.name == "Comic Market 107"
      file_path = "app/assets/images/circle_cuts/#{circle[:name]}.webp"
    else
      file_path = ""
    end
    if File.exist?(file_path)
      booth.image = File.open(Rails.root.join(file_path))
    end
    booth.save!
    if i % 10 == 0
      favorite = Favorite.new(
        priority: rand(1..9),
        notes: Faker::Lorem.paragraph
      )
      favorite.booth = booth
      favorite.user = User.all.first
      favorite.save!
    end
    if booth.circle.name == "U.S.S.ユキカゼ"
      notification = Notification.new(
        source: "X",
        content: "あなたのサークル「U.S.S.ユキカゼ」は、Comic Paradiseで「#{booth.booth_space}」に配置されました！\nコミパ受かったよー！",
        url: Faker::Internet.url,
        read: true
      )
      notification.booth = booth
      notification.save!
      notification = Notification.new(
        source: "X",
        content: "Comic Paradiseの新刊は…ございません！",
        url: Faker::Internet.url,
        read: false
      )
      notification.booth = booth
      notification.save!
    else
      rand(3..5).times do
        notification = Notification.new(
          source: %w(X pixiv Misskey DLsite).sample,
          content: Faker::Lorem.paragraph,
          url: Faker::Internet.url,
          read: [true, false].sample
        )
        notification.booth = booth
        notification.save!
      end
    end
    circle_works = WORKS.select {|work| work[:circle] == booth.circle.name}
    if circle_works
      circle_works.each do |work|
        booth_work = BoothWork.new(
          title: work[:title],
          circle: work[:circle],
          price: [100, 500, 1000].sample,
          new_release: work[:new_release],
          limit: nil,
          num_to_buy: rand(1..2),
        )
        booth_work.notes = "Buy 1 for friend" if booth_work.num_to_buy == 2
        booth_work.booth = booth
        booth_work.save!
      end
    else
      rand(1..5).times do
        booth_work = BoothWork.new(
          title: [Faker::Book.title].sample,
          circle: [booth.circle.name, Circle.all.sample].sample,
          price: rand(1..15) * 100,
          new_release: [true, false].sample,
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
end
puts "...#{Event.count} events created"
puts "...#{BookmarkedEvent.count} bookmarked events created"
puts "...#{Booth.count} booths created"
puts "...#{Favorite.count} favorites created"
puts "...#{Notification.count} notifications created"
puts "...#{BoothWork.count} booth works created"

puts "Creating fully fake Events, Bookmarked Events, Booths, Favorites, Notifications, and Booth Works..."

10.times do
  event = Event.create!(
    name: Faker::FunnyName.unique.name,
    venue: Faker::Company.name,
    description: Faker::Lorem.paragraph,
    start_date: Date.today,
    end_date: Date.today + 1
  )
  bookmarked_event = BookmarkedEvent.new
  bookmarked_event.user = User.all.sample
  bookmarked_event.event = event
  bookmarked_event.save!
  num = rand(20..30)
  sample_arr = Circle.all.sample(num)
  booth_num = (10..50).to_a.sample(num)
  num.times do |i|
    booth = Booth.new(
      booth_day: [event.start_date, event.end_date].sample,
      booth_space: ("A".."z").to_a.sample + booth_num[i].to_s + %w(a b).sample,
      genre: Faker::Book.genre,
      description: Faker::Lorem.paragraph,
    )
    booth.event = event
    booth.circle = sample_arr[i]
    booth.save!
    if i % 3 == 0
      favorite = Favorite.new(
        priority: rand(1..9),
        notes: Faker::Lorem.paragraph
      )
      favorite.booth = booth
      favorite.user = User.all.sample
      favorite.save!
    end
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
        title: Faker::FunnyName.name,
        circle: booth.circle.name,
        price: rand(1..15) * 100,
        new_release: [true, false].sample,
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

puts "...#{Event.count} total events created"
puts "...#{BookmarkedEvent.count} total bookmarked events created"
puts "...#{Booth.count} total booths created"
puts "...#{Favorite.count} total favorites created"
puts "...#{Notification.count} total notifications created"
puts "...#{BoothWork.count} total booth works created"
