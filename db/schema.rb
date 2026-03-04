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

ActiveRecord::Schema[8.1].define(version: 2026_03_04_032600) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "bookmarked_events", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "event_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["event_id"], name: "index_bookmarked_events_on_event_id"
    t.index ["user_id"], name: "index_bookmarked_events_on_user_id"
  end

  create_table "booth_works", force: :cascade do |t|
    t.bigint "booth_id", null: false
    t.string "circle", default: ""
    t.datetime "created_at", null: false
    t.integer "limit"
    t.boolean "new"
    t.text "notes", default: ""
    t.integer "num_bought"
    t.integer "num_to_buy"
    t.integer "price"
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["booth_id"], name: "index_booth_works_on_booth_id"
  end

  create_table "booths", force: :cascade do |t|
    t.date "booth_day"
    t.string "booth_space"
    t.bigint "circle_id", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.bigint "event_id", null: false
    t.string "genre", default: ""
    t.datetime "updated_at", null: false
    t.index ["circle_id"], name: "index_booths_on_circle_id"
    t.index ["event_id"], name: "index_booths_on_event_id"
  end

  create_table "circle_works", force: :cascade do |t|
    t.bigint "circle_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "work_id", null: false
    t.index ["circle_id"], name: "index_circle_works_on_circle_id"
    t.index ["work_id"], name: "index_circle_works_on_work_id"
  end

  create_table "circles", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description", default: ""
    t.string "name"
    t.string "name_reading"
    t.datetime "updated_at", null: false
  end

  create_table "collection_works", force: :cascade do |t|
    t.bigint "collection_id", null: false
    t.datetime "created_at", null: false
    t.text "notes", default: ""
    t.datetime "updated_at", null: false
    t.bigint "work_id", null: false
    t.index ["collection_id"], name: "index_collection_works_on_collection_id"
    t.index ["work_id"], name: "index_collection_works_on_work_id"
  end

  create_table "collections", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_collections_on_user_id"
  end

  create_table "events", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description", default: ""
    t.date "end_date"
    t.string "name"
    t.date "start_date"
    t.datetime "updated_at", null: false
    t.string "venue"
  end

  create_table "favorites", force: :cascade do |t|
    t.bigint "booth_id", null: false
    t.datetime "created_at", null: false
    t.text "notes", default: ""
    t.integer "priority"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["booth_id"], name: "index_favorites_on_booth_id"
    t.index ["user_id"], name: "index_favorites_on_user_id"
  end

  create_table "included_works", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "title"
    t.datetime "updated_at", null: false
    t.bigint "work_id", null: false
    t.index ["work_id"], name: "index_included_works_on_work_id"
  end

  create_table "notifications", force: :cascade do |t|
    t.bigint "booth_id", null: false
    t.string "content"
    t.datetime "created_at", null: false
    t.boolean "read"
    t.string "source"
    t.datetime "updated_at", null: false
    t.string "url"
    t.index ["booth_id"], name: "index_notifications_on_booth_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.date "date_of_birth"
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.datetime "updated_at", null: false
    t.string "username"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  create_table "works", force: :cascade do |t|
    t.boolean "adult"
    t.datetime "created_at", null: false
    t.text "description", default: ""
    t.boolean "digital"
    t.string "download_source"
    t.string "medium"
    t.date "orig_published_on"
    t.date "published_on"
    t.string "size"
    t.string "title"
    t.string "title_reading"
    t.datetime "updated_at", null: false
    t.string "version"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "bookmarked_events", "events"
  add_foreign_key "bookmarked_events", "users"
  add_foreign_key "booth_works", "booths"
  add_foreign_key "booths", "circles"
  add_foreign_key "booths", "events"
  add_foreign_key "circle_works", "circles"
  add_foreign_key "circle_works", "works"
  add_foreign_key "collection_works", "collections"
  add_foreign_key "collection_works", "works"
  add_foreign_key "collections", "users"
  add_foreign_key "favorites", "booths"
  add_foreign_key "favorites", "users"
  add_foreign_key "included_works", "works"
  add_foreign_key "notifications", "booths"
end
