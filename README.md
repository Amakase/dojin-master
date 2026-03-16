# 📚 Dōjin Master

A Ruby on Rails web app that helps users browse and prioritize booths to visit at dōjin market events and can provide guidance on best routes to visit the booths at the event.
Created as a final group project for the Le Wagon AI Software Development bootcamp.

_DROP SCREENSHOT HERE_
<br>
App home: https://dojin-master-0ad16a019c35.herokuapp.com/
   
## Getting Started
### Setup

Install gems
```
bundle install
```

### ENV Variables
Create `.env` file
```
touch .env
```
Inside `.env`, set these variables
```
CLOUDINARY_URL=your_own_cloudinary_url_key
```

### DB Setup
```
rails db:create
rails db:migrate
rails db:seed
```

## Setup for Suggest Route feature using the example M3-2026 event
### Create Admin
Create admin account using rails console
```
User.create!(admin: true, username: "USERNAME", email: "EMAIL_ADDRESS", password: "PASSWORD", date_of_birth: Date.new(YEAR, MONTH, DAY))
```
### Attach Map
Attach map image to M3-2026 event
```
event = Event.find(1)
event.images.attach(io: File.open("/app/assets/images/floor_plans/Screenshot 2026-03-10 at 14.38.25.png"), filename: "M3_2026_floor_plan.png", content_type: "image/png")
```
### Populate Map
- Navigate to the site with your web browser
- Log in as the admin
- Navigate to the Map Editor page (/admin/events/:event_id/map_editor) (where :event_id is 1 for M3-2026)
- Use the Map editor to add rectangles for the booth spaces
  - CAUTION: DO NOT USE THE AI AUTO-PLACE
  - Can place an anchor in each section and use the Draw Section in the upper right to fill out the rest
- Use the map editor to draw in walls

## Built With
- [Rails 8.1](https://guides.rubyonrails.org/) - Backend / Front-end
- [Hotwire (Turbo + Stimulus JS)](https://hotwired.dev/) - Front-end JS
- [Heroku](https://heroku.com/) - Deployment
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Bootstrap](https://getbootstrap.com/) — Styling
- [SASS](https://sass-lang.com/) — Styling
- [Figma](https://www.figma.com) — Prototyping

## Team Members
- [Steven V. Sawadisavi](https://github.com/Amakase)
- [Jonathan Kiichi Kimura](https://github.com/jonathankiichikimura)
- [Raphael Barbosa](https://github.com/sp1aca9fa)
- [Cheng Chun Yin (Steven)](https://github.com/stevench95)
