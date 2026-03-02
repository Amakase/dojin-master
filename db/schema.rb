# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_03_02_142159) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "booths", force: :cascade do |t|
    t.date "booth_day"
    t.string "booth_space"
    t.bigint "circle_id", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.bigint "event_id", null: false
    t.string "genre"
    t.datetime "updated_at", null: false
    t.index ["circle_id"], name: "index_booths_on_circle_id"
    t.index ["event_id"], name: "index_booths_on_event_id"
  end

  create_table "circles", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name"
    t.string "name_reading"
    t.text "notes"
    t.datetime "updated_at", null: false
  end

  create_table "collections", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.bigint "work_id", null: false
    t.index ["user_id"], name: "index_collections_on_user_id"
    t.index ["work_id"], name: "index_collections_on_work_id"
  end

  create_table "events", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.date "end_date"
    t.string "name"
    t.date "start_date"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.string "venue"
    t.index ["user_id"], name: "index_events_on_user_id"
  end

  create_table "favorites", force: :cascade do |t|
    t.bigint "booth_id", null: false
    t.datetime "created_at", null: false
    t.text "notes"
    t.integer "priority"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["booth_id"], name: "index_favorites_on_booth_id"
    t.index ["user_id"], name: "index_favorites_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "first_name"
    t.string "last_name"
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  create_table "works", force: :cascade do |t|
    t.boolean "adult"
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "digital"
    t.string "download_source"
    t.string "medium"
    t.text "notes"
    t.date "orig_published_on"
    t.date "published_on"
    t.string "size"
    t.string "title"
    t.string "title_reading"
    t.datetime "updated_at", null: false
    t.string "version"
  end

  add_foreign_key "booths", "circles"
  add_foreign_key "booths", "events"
  add_foreign_key "collections", "users"
  add_foreign_key "collections", "works"
  add_foreign_key "events", "users"
  add_foreign_key "favorites", "booths"
  add_foreign_key "favorites", "users"
end
