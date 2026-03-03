class CreateFavorites < ActiveRecord::Migration[8.1]
  def change
    create_table :favorites do |t|
      t.references :user, null: false, foreign_key: true
      t.references :booth, null: false, foreign_key: true
      t.integer :priority
      t.text :notes

      t.timestamps
    end
  end
end
