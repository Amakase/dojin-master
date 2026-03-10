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

KATAKANA = ["ブレーキ", "アップル", "ヱヴァンゲリオン", "ビックカメラ", "エクスプロージョン", "プラスアルファ", "イッセキニチョウ", "ガンダム", "メグロ", "アオイトリ"]

filepath = "app/assets/csv/events.csv"
events = []
CSV.foreach(filepath, headers: :first_row, converters: :date) do |row|
  events << {
    name: row['name'],
    venue: row['venue'],
    start_date: row['start_date'],
    end_date: row['end_date'],
    description: row['description'] }
end

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

filepath = "app/assets/csv/c107_circles.csv"
c107_circles = []
CSV.foreach(filepath, headers: :first_row, converters: :date) do |row|
  c107_circles << {
    name: row['name'],
    name_reading: row['name_reading'],
    booth_day: row['booth_day'],
    booth_space: row['booth_space'],
    genre: row['genre'],
    description: row['description'] }
end

filepath = "app/assets/csv/works.csv"
works_list = []
CSV.foreach(filepath, headers: :first_row, converters: :date) do |row|
  works_list << {
    circle: row['circle'],
    title: row['title'],
    size: row['size'],
    new_release: row['new_release'] == 'true' }
end

filepath = "app/assets/csv/notifications.csv"
notifications_list = []
CSV.foreach(filepath, headers: :first_row, converters: :date) do |row|
  notifications_list << {
    circle: row['circle'],
    source: row['source'],
    content: row['content'],
    read: row['read'] == 'true' }
end

puts "Clearing Circle DB..."
Circle.destroy_all
puts "Clearing User DB..."
User.destroy_all
puts "Clearing Works DB..."
Work.destroy_all
puts "Clearing Events DB..."
Event.destroy_all


puts "Creating M3-2025 Spring circles..."

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

c107_circles.each do |circle|
  Circle.create!(
    name: circle[:name],
    name_reading: circle[:name_reading],
    description: circle[:description]
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

events.each do |this_event|
  event = Event.new(
    name: this_event[:name],
    venue: this_event[:venue],
    description: this_event[:description],
    start_date: this_event[:start_date],
    end_date: this_event[:end_date]
  )
  file_path = "app/assets/images/events/#{event.name}.png"
  if File.exist?(file_path)
    event.image = File.open(Rails.root.join(file_path))
  end
  event.save!
  puts "...“#{event.name}” event created"
  User.all.each do |user|
    bookmarked_event = BookmarkedEvent.new
    bookmarked_event.user = user
    bookmarked_event.event = event
    bookmarked_event.save!
  end
  if event.name == "M3-2025春"
    seed_circles = m3_circles
  elsif event.name == "Comic Market 107"
    seed_circles = c107_circles
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
    booth_notifications = notifications_list.select {|notification_item| notification_item[:circle] == booth.circle.name }
    if booth_notifications.any?
      booth_notifications.each do |notification_item|
        notification = Notification.new(
          source: notification_item[:source],
          content: notification_item[:content],
          url: Faker::Internet.url,
          read: notification_item[:read]
        )
        notification.booth = booth
        notification.save!
      end
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
    circle_works = works_list.select {|work| work[:circle] == booth.circle.name}
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
  puts "...“#{event.name}” bookmarked events, booths, favorites, notifications, and booth works created"
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
  puts "...“#{event.name}” event created"
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
