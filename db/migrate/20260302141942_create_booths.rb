class CreateBooths < ActiveRecord::Migration[8.1]
  def change
    create_table :booths do |t|
      t.date :booth_day
      t.string :booth_space
      t.string :genre
      t.text :description
      t.references :event, null: false, foreign_key: true
      t.references :circle, null: false, foreign_key: true

      t.timestamps
    end
  end
end
