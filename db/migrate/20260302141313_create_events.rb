class CreateEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :events do |t|
      t.string :name
      t.string :venue
      t.text :description
      t.date :start_date
      t.date :end_date
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end
  end
end
